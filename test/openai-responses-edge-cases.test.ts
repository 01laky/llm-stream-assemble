import { describe, expect, it } from "vitest";
import { openaiResponsesAdapter } from "../src/adapters/openai-responses";
import { assembleFromPayloads } from "../src/core/assemble-payloads";
import { assembleResponse } from "../src/core/assemble-response";
import { assembleStream } from "../src/core/assemble-stream";
import { byteStreamFromStrings, collectAsync, strings } from "./helpers/collect-events";
import {
	expectedResponsesEvents,
	normalizeResponsesEvents,
	responsesJSONFixture,
	responsesTextFixture,
} from "./helpers/responses-fixtures";

const payload = (value: unknown) => JSON.stringify(value);

describe("openaiResponsesAdapter edge cases", () => {
	it("LSA-R33: empty or whitespace line yields no chunks", () => {
		expect(openaiResponsesAdapter().parseChunk("")).toEqual([]);
		expect(openaiResponsesAdapter().parseChunk("   ")).toEqual([]);
	});

	it("LSA-R34: [DONE] marker yields no chunks", () => {
		expect(openaiResponsesAdapter().parseChunk("[DONE]")).toEqual([]);
	});

	it("LSA-R35: non-object JSON throws scoped expected object error", () => {
		expect(() => openaiResponsesAdapter().parseChunk(JSON.stringify(42))).toThrow(
			/openaiResponsesAdapter\.parseChunk: expected a JSON object/,
		);
	});

	it("LSA-R36: error payload maps provider-error and finish error", () => {
		const chunks = openaiResponsesAdapter().parseChunk(
			payload({ type: "error", error: { message: "bad key" } }),
		);
		expect(chunks).toHaveLength(2);
		expect(chunks[0]?.kind).toBe("provider-error");
		expect(chunks[1]).toEqual({ kind: "finish", reason: "error" });
	});

	it("LSA-R37: response.failed emits provider error finish", () => {
		const chunks = openaiResponsesAdapter().parseChunk(
			payload({
				type: "response.failed",
				response: { error: { message: "model failed" } },
			}),
		);
		expect(chunks.some((chunk) => chunk.kind === "provider-error")).toBe(true);
		expect(chunks).toContainEqual({ kind: "finish", reason: "error" });
	});

	it("LSA-R38: response.incomplete emits finish incomplete", () => {
		const chunks = openaiResponsesAdapter().parseChunk(
			payload({
				type: "response.incomplete",
				response: { usage: { input_tokens: 1, output_tokens: 0 } },
			}),
		);
		expect(chunks).toContainEqual({ kind: "finish", reason: "incomplete" });
	});

	it("LSA-R39: unknown event type falls through to reasoningChunks when fields present", () => {
		expect(
			openaiResponsesAdapter().parseChunk(
				payload({ type: "response.custom.reasoning", reasoning: "hidden" }),
			),
		).toEqual([{ kind: "reasoning-delta", text: "hidden", variant: "detail" }]);
	});

	it("LSA-R40: assembler drops post-finish usage tail", async () => {
		async function* payloads() {
			yield payload({ type: "response.output_text.delta", delta: "x" });
			yield payload({ type: "response.completed", response: { usage: { input_tokens: 1 } } });
			yield payload({
				type: "response.output_text.delta",
				delta: "late",
			});
		}
		const events = await collectAsync(assembleFromPayloads(payloads(), openaiResponsesAdapter()));
		expect(events.filter((event) => event.type === "text.delta").length).toBe(1);
	});

	it("LSA-R45: malformed JSON throws openaiResponsesAdapter.parseChunk prefix", () => {
		expect(() => openaiResponsesAdapter().parseChunk("{")).toThrow(
			/openaiResponsesAdapter\.parseChunk/,
		);
	});

	it("LSA-R46: jsonMode maps output_text.delta to json-delta", async () => {
		const events = await collectAsync(
			assembleFromPayloads(
				strings(
					payload({ type: "response.output_text.delta", delta: '{"ok":true}' }),
					payload({ type: "response.completed", response: {} }),
				),
				openaiResponsesAdapter({ jsonMode: true }),
			),
		);
		expect(events.some((event) => event.type === "json.delta")).toBe(true);
		expect(events.some((event) => event.type === "text.delta")).toBe(false);
	});

	it("LSA-R47: response.refusal.delta maps to refusal-delta", () => {
		expect(
			openaiResponsesAdapter().parseChunk(
				payload({ type: "response.refusal.delta", delta: "no thanks" }),
			),
		).toEqual([{ kind: "refusal-delta", text: "no thanks" }]);
	});

	it("LSA-R48: parallel function_call items keep distinct tool ids", async () => {
		async function* payloads() {
			yield payload({
				type: "response.output_item.added",
				output_index: 0,
				item: { type: "function_call", id: "call_a", name: "alpha", call_id: "call_a" },
			});
			yield payload({
				type: "response.output_item.added",
				output_index: 1,
				item: { type: "function_call", id: "call_b", name: "beta", call_id: "call_b" },
			});
			yield payload({ type: "response.completed", response: {} });
		}
		const events = await collectAsync(assembleFromPayloads(payloads(), openaiResponsesAdapter()));
		const starts = events.filter((event) => event.type === "tool_call.start");
		expect(starts.map((event) => event.id)).toEqual(["call_a", "call_b"]);
	});

	it("LSA-R49: duplicate response.completed after finish is dropped by assembler", async () => {
		async function* payloads() {
			yield payload({ type: "response.output_text.delta", delta: "done" });
			yield payload({ type: "response.completed", response: {} });
			yield payload({ type: "response.completed", response: {} });
		}
		const events = await collectAsync(assembleFromPayloads(payloads(), openaiResponsesAdapter()));
		expect(events.filter((event) => event.type === "finish")).toHaveLength(1);
	});

	it("LSA-R50: response.output_text.done emits text when no prior delta", async () => {
		const events = await collectAsync(
			assembleFromPayloads(
				strings(
					payload({ type: "response.output_text.done", text: "full text" }),
					payload({ type: "response.completed", response: {} }),
				),
				openaiResponsesAdapter(),
			),
		);
		expect(events.some((event) => event.type === "text.delta" && event.text === "full text")).toBe(
			true,
		);
	});

	it("LSA-R51: response.function_call_arguments.delta streams tool args", async () => {
		const events = await collectAsync(
			assembleFromPayloads(
				strings(
					payload({
						type: "response.output_item.added",
						output_index: 0,
						item: { type: "function_call", id: "call_x", name: "search", call_id: "call_x" },
					}),
					payload({
						type: "response.function_call_arguments.delta",
						output_index: 0,
						call_id: "call_x",
						delta: '{"q":',
					}),
					payload({
						type: "response.function_call_arguments.delta",
						output_index: 0,
						call_id: "call_x",
						delta: '"x"}',
					}),
					payload({ type: "response.completed", response: {} }),
				),
				openaiResponsesAdapter(),
			),
		);
		expect(events.some((event) => event.type === "tool_call.args.delta")).toBe(true);
		expect(events.some((event) => event.type === "tool_call.done")).toBe(true);
	});

	it("LSA-R52: response.output_item.done emits tool_call.done", async () => {
		const events = await collectAsync(
			assembleFromPayloads(
				strings(
					payload({
						type: "response.output_item.added",
						output_index: 0,
						item: { type: "function_call", id: "call_d", name: "ping", call_id: "call_d" },
					}),
					payload({
						type: "response.output_item.done",
						output_index: 0,
						item: { type: "function_call", id: "call_d", name: "ping", call_id: "call_d" },
					}),
					payload({ type: "response.completed", response: {} }),
				),
				openaiResponsesAdapter(),
			),
		);
		expect(events.filter((event) => event.type === "tool_call.done")).toHaveLength(1);
	});

	it("LSA-R53: assembler drops post-finish reasoning deltas", async () => {
		async function* payloads() {
			yield payload({ type: "response.output_text.delta", delta: "ok" });
			yield payload({ type: "response.completed", response: {} });
			yield payload({ type: "response.custom.reasoning", reasoning: "late" });
		}
		const events = await collectAsync(assembleFromPayloads(payloads(), openaiResponsesAdapter()));
		expect(events.filter((event) => event.type === "reasoning.delta")).toHaveLength(0);
	});

	it("LSA-R54: summary field in unknown event maps reasoning summary variant", () => {
		expect(
			openaiResponsesAdapter().parseChunk(
				payload({ type: "response.custom.summary", summary: "short plan" }),
			),
		).toEqual([{ kind: "reasoning-delta", text: "short plan", variant: "summary" }]);
	});

	it("LSA-R55: unicode output_text.delta preserved through assembly", async () => {
		const events = await collectAsync(
			assembleFromPayloads(
				strings(
					payload({ type: "response.output_text.delta", delta: "čaj 🍵" }),
					payload({ type: "response.completed", response: {} }),
				),
				openaiResponsesAdapter(),
			),
		);
		expect(events.some((event) => event.type === "text.delta" && event.text === "čaj 🍵")).toBe(
			true,
		);
	});

	it("LSA-R56: duplicate response.incomplete after finish is dropped by assembler", async () => {
		const events = await collectAsync(
			assembleFromPayloads(
				strings(
					payload({ type: "response.output_text.delta", delta: "x" }),
					payload({ type: "response.incomplete", response: {} }),
					payload({ type: "response.incomplete", response: {} }),
				),
				openaiResponsesAdapter(),
			),
		);
		expect(events.filter((event) => event.type === "finish")).toHaveLength(1);
	});

	it("LSA-R57: failed golden stream matches expected events", async () => {
		const events = normalizeResponsesEvents(
			await collectAsync(
				assembleStream(
					byteStreamFromStrings(responsesTextFixture("failed", "sse")),
					openaiResponsesAdapter(),
				),
			),
		);
		expect(events).toEqual(expectedResponsesEvents("failed"));
	});

	it("LSA-R58: response.content_part.added json text maps with jsonMode", () => {
		expect(
			openaiResponsesAdapter({ jsonMode: true }).parseChunk(
				payload({
					type: "response.content_part.added",
					part: { type: "output_text", text: '{"k":1}' },
				}),
			),
		).toContainEqual({ kind: "json-delta", delta: '{"k":1}' });
	});

	it("LSA-R59: jsonMode assembler drops post-finish json delta", async () => {
		async function* payloads() {
			yield payload({ type: "response.output_text.delta", delta: '{"a":1}' });
			yield payload({ type: "response.completed", response: {} });
			yield payload({ type: "response.output_text.delta", delta: '{"late":true}' });
		}
		const events = await collectAsync(
			assembleFromPayloads(payloads(), openaiResponsesAdapter({ jsonMode: true })),
		);
		expect(
			events.some((event) => event.type === "json.delta" && event.delta.includes("late")),
		).toBe(false);
	});

	it("LSA-R60: assembler drops post-finish refusal delta", async () => {
		async function* payloads() {
			yield payload({ type: "response.output_text.delta", delta: "ok" });
			yield payload({ type: "response.completed", response: {} });
			yield payload({ type: "response.refusal.delta", delta: "late refusal" });
		}
		const events = await collectAsync(assembleFromPayloads(payloads(), openaiResponsesAdapter()));
		expect(events.filter((event) => event.type === "refusal.delta")).toHaveLength(0);
	});

	it("LSA-R61: assembler drops post-finish function_call_arguments delta", async () => {
		async function* payloads() {
			yield payload({
				type: "response.output_item.added",
				output_index: 0,
				item: { type: "function_call", id: "call_late", name: "fn", call_id: "call_late" },
			});
			yield payload({ type: "response.completed", response: {} });
			yield payload({
				type: "response.function_call_arguments.delta",
				output_index: 0,
				call_id: "call_late",
				delta: '{"late":true}',
			});
		}
		const events = await collectAsync(assembleFromPayloads(payloads(), openaiResponsesAdapter()));
		expect(events.filter((event) => event.type === "tool_call.args.delta")).toHaveLength(0);
	});

	it("LSA-R62: empty output_text.delta is skipped", () => {
		expect(
			openaiResponsesAdapter().parseChunk(
				payload({ type: "response.output_text.delta", delta: "" }),
			),
		).toEqual([]);
	});

	it("LSA-R63: incomplete golden stream matches expected events", async () => {
		const events = normalizeResponsesEvents(
			await collectAsync(
				assembleStream(
					byteStreamFromStrings(responsesTextFixture("incomplete", "sse")),
					openaiResponsesAdapter(),
				),
			),
		);
		expect(events).toEqual(expectedResponsesEvents("incomplete"));
	});

	it("LSA-R64: json-mode golden stream matches expected events", async () => {
		const events = normalizeResponsesEvents(
			await collectAsync(
				assembleStream(
					byteStreamFromStrings(responsesTextFixture("json-mode", "sse")),
					openaiResponsesAdapter({ jsonMode: true }),
				),
			),
		);
		expect(events).toEqual(expectedResponsesEvents("json-mode"));
	});

	it("LSA-R65: refusal golden stream matches expected events", async () => {
		const events = normalizeResponsesEvents(
			await collectAsync(
				assembleStream(
					byteStreamFromStrings(responsesTextFixture("refusal", "sse")),
					openaiResponsesAdapter(),
				),
			),
		);
		expect(events).toEqual(expectedResponsesEvents("refusal"));
	});

	it("LSA-R66: parallel-function-call golden stream matches expected events", async () => {
		const events = normalizeResponsesEvents(
			await collectAsync(
				assembleStream(
					byteStreamFromStrings(responsesTextFixture("parallel-function-call", "sse")),
					openaiResponsesAdapter(),
				),
			),
		);
		expect(events).toEqual(expectedResponsesEvents("parallel-function-call"));
	});

	it("LSA-R67: function-call golden stream matches expected events", async () => {
		const events = normalizeResponsesEvents(
			await collectAsync(
				assembleStream(
					byteStreamFromStrings(responsesTextFixture("function-call", "sse")),
					openaiResponsesAdapter(),
				),
			),
		);
		expect(events).toEqual(expectedResponsesEvents("function-call"));
	});

	it("LSA-R68: args-before-item golden stream matches expected events", async () => {
		const events = normalizeResponsesEvents(
			await collectAsync(
				assembleStream(
					byteStreamFromStrings(responsesTextFixture("args-before-item", "sse")),
					openaiResponsesAdapter(),
				),
			),
		);
		expect(events).toEqual(expectedResponsesEvents("args-before-item"));
	});

	it("LSA-R69: response.completed with usage emits usage before finish closes stream", async () => {
		const events = await collectAsync(
			assembleFromPayloads(
				strings(
					payload({ type: "response.output_text.delta", delta: "x" }),
					payload({
						type: "response.completed",
						response: { usage: { input_tokens: 2, output_tokens: 1 } },
					}),
				),
				openaiResponsesAdapter(),
			),
		);
		expect(events.some((event) => event.type === "usage")).toBe(true);
		expect(events.some((event) => event.type === "finish")).toBe(true);
	});

	it("LSA-R70: text-basic golden stream matches expected events", async () => {
		const events = normalizeResponsesEvents(
			await collectAsync(
				assembleStream(
					byteStreamFromStrings(responsesTextFixture("text-basic", "sse")),
					openaiResponsesAdapter(),
				),
			),
		);
		expect(events).toEqual(expectedResponsesEvents("text-basic"));
	});

	it("LSA-R74: logprobs-failed-stream stops logprobs after terminal error", async () => {
		const events = normalizeResponsesEvents(
			await collectAsync(
				assembleStream(
					byteStreamFromStrings(responsesTextFixture("logprobs-failed-stream", "sse")),
					openaiResponsesAdapter(),
				),
			),
		);
		expect(events).toEqual(expectedResponsesEvents("logprobs-failed-stream"));
	});

	it("LSA-R75: done-batch stream emits logprobs only when no prior deltas", async () => {
		const events = normalizeResponsesEvents(
			await collectAsync(
				assembleStream(
					byteStreamFromStrings(responsesTextFixture("logprobs-done-batch", "sse")),
					openaiResponsesAdapter(),
				),
			),
		);
		expect(events.filter((event) => event.type === "logprob")).toHaveLength(2);
	});

	it("LSA-R76: logprobs-stream interleaves logprob before each text.delta", async () => {
		const events = normalizeResponsesEvents(
			await collectAsync(
				assembleStream(
					byteStreamFromStrings(responsesTextFixture("logprobs-stream", "sse")),
					openaiResponsesAdapter(),
				),
			),
		);
		const types = events.map((event) => event.type);
		const firstText = types.indexOf("text.delta");
		const firstLogprob = types.indexOf("logprob");
		expect(firstLogprob).toBeLessThan(firstText);
	});

	it("LSA-R77: logprobs-tool-stream has exactly one content logprob event", async () => {
		const events = normalizeResponsesEvents(
			await collectAsync(
				assembleStream(
					byteStreamFromStrings(responsesTextFixture("logprobs-tool-stream", "sse")),
					openaiResponsesAdapter(),
				),
			),
		);
		expect(events.filter((event) => event.type === "logprob")).toHaveLength(1);
	});

	it("LSA-R78: logprobs-refusal-stream golden matches expected", async () => {
		const events = normalizeResponsesEvents(
			await collectAsync(
				assembleStream(
					byteStreamFromStrings(responsesTextFixture("logprobs-refusal", "sse")),
					openaiResponsesAdapter(),
				),
			),
		);
		expect(events).toEqual(expectedResponsesEvents("logprobs-refusal"));
	});

	it("LSA-R79: parseResponse logprobs-refusal-response golden parity", () => {
		const events = normalizeResponsesEvents(
			assembleResponse(responsesJSONFixture("logprobs-refusal-response"), openaiResponsesAdapter()),
		);
		expect(events).toEqual(expectedResponsesEvents("logprobs-refusal-response"));
	});

	it("LSA-R80: text-basic stream still has zero logprob events after mapping shipped", async () => {
		const events = normalizeResponsesEvents(
			await collectAsync(
				assembleStream(
					byteStreamFromStrings(responsesTextFixture("text-basic", "sse")),
					openaiResponsesAdapter(),
				),
			),
		);
		expect(events.some((event) => event.type === "logprob")).toBe(false);
	});

	it("LSA-R81: logprobs-json-mode stream golden under jsonMode option", async () => {
		const events = normalizeResponsesEvents(
			await collectAsync(
				assembleStream(
					byteStreamFromStrings(responsesTextFixture("logprobs-json-mode", "sse")),
					openaiResponsesAdapter({ jsonMode: true }),
				),
			),
		);
		expect(events).toEqual(expectedResponsesEvents("logprobs-json-mode"));
	});

	it("LSA-R82: logprobs-content-part-added golden parity", async () => {
		const events = normalizeResponsesEvents(
			await collectAsync(
				assembleStream(
					byteStreamFromStrings(responsesTextFixture("logprobs-content-part-added", "sse")),
					openaiResponsesAdapter(),
				),
			),
		);
		expect(events).toEqual(expectedResponsesEvents("logprobs-content-part-added"));
	});

	it("LSA-R83: logprobs-response non-stream golden parity", () => {
		const events = normalizeResponsesEvents(
			assembleResponse(responsesJSONFixture("logprobs-response"), openaiResponsesAdapter()),
		);
		expect(events).toEqual(expectedResponsesEvents("logprobs-response"));
	});

	it("LSA-R84: consecutive adapter instances do not share textSeen for done-batch", async () => {
		await collectAsync(
			assembleStream(
				byteStreamFromStrings(responsesTextFixture("logprobs-stream", "sse")),
				openaiResponsesAdapter(),
			),
		);
		const events = normalizeResponsesEvents(
			await collectAsync(
				assembleStream(
					byteStreamFromStrings(responsesTextFixture("logprobs-done-batch", "sse")),
					openaiResponsesAdapter(),
				),
			),
		);
		expect(events.filter((event) => event.type === "logprob")).toHaveLength(2);
	});

	it("LSA-R85: logprobs-failed-stream has logprobs strictly before error event", async () => {
		const events = normalizeResponsesEvents(
			await collectAsync(
				assembleStream(
					byteStreamFromStrings(responsesTextFixture("logprobs-failed-stream", "sse")),
					openaiResponsesAdapter(),
				),
			),
		);
		const lastLogprob = events.map((event) => event.type).lastIndexOf("logprob");
		const errorIndex = events.findIndex((event) => event.type === "error");
		expect(lastLogprob).toBeGreaterThanOrEqual(0);
		expect(errorIndex).toBeGreaterThan(lastLogprob);
	});
});
