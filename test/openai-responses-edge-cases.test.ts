import { describe, expect, it } from "vitest";
import { openaiResponsesAdapter } from "../src/adapters/openai-responses";
import { assembleFromPayloads } from "../src/core/assemble-payloads";
import { assembleStream } from "../src/core/assemble-stream";
import { byteStreamFromStrings, collectAsync, strings } from "./helpers/collect-events";
import {
	expectedResponsesEvents,
	normalizeResponsesEvents,
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
});
