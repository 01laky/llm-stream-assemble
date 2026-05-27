import { describe, expect, it } from "vitest";
import { openaiChatAdapter } from "../src/adapters/openai-chat";
import { assembleFromPayloads } from "../src/core/assemble-payloads";
import { assembleStream } from "../src/core/assemble-stream";
import { byteStreamFromStrings, collectAsync, strings } from "./helpers/collect-events";
import {
	expectedOpenAIEvents,
	normalizeEvents,
	openAITextFixture,
} from "./helpers/openai-fixtures";

const payload = (value: unknown) => JSON.stringify(value);

describe("openaiChatAdapter edge cases", () => {
	it("LSA-OC229: empty or whitespace SSE payload line yields no chunks", () => {
		expect(openaiChatAdapter().parseChunk("")).toEqual([]);
		expect(openaiChatAdapter().parseChunk("   ")).toEqual([]);
	});

	it("LSA-OC230: [DONE] marker yields no chunks", () => {
		expect(openaiChatAdapter().parseChunk("[DONE]")).toEqual([]);
	});

	it("LSA-OC231: malformed JSON throws openaiChatAdapter.parseChunk prefix", () => {
		expect(() => openaiChatAdapter().parseChunk("{")).toThrow(/openaiChatAdapter\.parseChunk/);
	});

	it("LSA-OC232: non-object JSON throws expected object error", () => {
		expect(() => openaiChatAdapter().parseChunk(JSON.stringify(null))).toThrow(
			/expected a JSON object/,
		);
	});

	it("LSA-OC233: finish_reason stop terminates stream and drops trailing deltas", async () => {
		async function* payloads() {
			yield payload({
				id: "c1",
				object: "chat.completion.chunk",
				choices: [{ index: 0, delta: { content: "ok" }, finish_reason: null }],
			});
			yield payload({
				id: "c1",
				object: "chat.completion.chunk",
				choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
			});
			yield payload({
				id: "c1",
				object: "chat.completion.chunk",
				choices: [{ index: 0, delta: { content: "nope" }, finish_reason: null }],
			});
		}
		const events = await collectAsync(assembleFromPayloads(payloads(), openaiChatAdapter()));
		expect(events.filter((event) => event.type === "text.delta")).toHaveLength(1);
	});

	it("LSA-OC234: jsonMode maps content delta to json-delta chunks", async () => {
		const events = await collectAsync(
			assembleFromPayloads(
				strings(
					payload({
						id: "c1",
						object: "chat.completion.chunk",
						choices: [{ index: 0, delta: { content: '{"a":1}' }, finish_reason: null }],
					}),
					payload({
						id: "c1",
						object: "chat.completion.chunk",
						choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
					}),
				),
				openaiChatAdapter({ jsonMode: true }),
			),
		);
		expect(events.some((event) => event.type === "json.delta")).toBe(true);
		expect(events.some((event) => event.type === "text.delta")).toBe(false);
	});

	it("LSA-OC235: delta.refusal maps to refusal-delta chunk", () => {
		expect(
			openaiChatAdapter().parseChunk(
				payload({
					id: "c1",
					object: "chat.completion.chunk",
					choices: [{ index: 0, delta: { refusal: "policy" }, finish_reason: null }],
				}),
			),
		).toContainEqual({ kind: "refusal-delta", text: "policy" });
	});

	it("LSA-OC236: finish_reason content_filter maps to finish content_filter", () => {
		expect(
			openaiChatAdapter().parseChunk(
				payload({
					id: "c1",
					object: "chat.completion.chunk",
					choices: [{ index: 0, delta: {}, finish_reason: "content_filter" }],
				}),
			),
		).toContainEqual({ kind: "finish", reason: "content_filter", choiceIndex: 0 });
	});

	it("LSA-OC237: streaming tool_calls emit tool-start and args-delta", () => {
		const adapter = openaiChatAdapter();
		const startChunks = adapter.parseChunk(
			payload({
				id: "c1",
				object: "chat.completion.chunk",
				choices: [
					{
						index: 0,
						delta: {
							tool_calls: [{ index: 0, id: "call_1", function: { name: "get_weather" } }],
						},
						finish_reason: null,
					},
				],
			}),
		);
		expect(startChunks).toContainEqual({
			kind: "tool-start",
			id: "call_1",
			name: "get_weather",
			index: 0,
			choiceIndex: 0,
		});

		expect(
			adapter.parseChunk(
				payload({
					id: "c1",
					object: "chat.completion.chunk",
					choices: [
						{
							index: 0,
							delta: {
								tool_calls: [{ index: 0, function: { arguments: '{"city":"Prague"}' } }],
							},
							finish_reason: null,
						},
					],
				}),
			),
		).toContainEqual({
			kind: "tool-args-delta",
			id: "call_1",
			delta: '{"city":"Prague"}',
			index: 0,
			choiceIndex: 0,
		});
	});

	it("LSA-OC238: assembler drops usage metadata after terminal finish", async () => {
		async function* payloads() {
			yield payload({
				id: "c1",
				object: "chat.completion.chunk",
				choices: [{ index: 0, delta: { content: "ok" }, finish_reason: null }],
			});
			yield payload({
				id: "c1",
				object: "chat.completion.chunk",
				choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
			});
			yield payload({
				id: "c1",
				object: "chat.completion.chunk",
				usage: { prompt_tokens: 5, completion_tokens: 1 },
				choices: [],
			});
		}
		const events = await collectAsync(assembleFromPayloads(payloads(), openaiChatAdapter()));
		expect(events.some((event) => event.type === "finish")).toBe(true);
		expect(events.some((event) => event.type === "usage")).toBe(false);
	});

	it("LSA-OC239: delta.reasoning maps to reasoning-delta", () => {
		expect(
			openaiChatAdapter().parseChunk(
				payload({
					id: "c1",
					object: "chat.completion.chunk",
					choices: [{ index: 0, delta: { reasoning: "thinking" }, finish_reason: null }],
				}),
			),
		).toContainEqual({ kind: "reasoning-delta", text: "thinking", variant: "detail" });
	});

	it("LSA-OC240: error object in chunk emits provider-error and finish error", () => {
		const chunks = openaiChatAdapter().parseChunk(
			payload({ error: { message: "invalid key", type: "invalid_request_error" } }),
		);
		expect(chunks[0]?.kind).toBe("provider-error");
		expect(chunks).toContainEqual({ kind: "finish", reason: "error" });
	});

	it("LSA-OC241: empty content delta emits no text-delta chunks", () => {
		const chunks = openaiChatAdapter().parseChunk(
			payload({
				id: "c1",
				object: "chat.completion.chunk",
				choices: [{ index: 0, delta: { content: "" }, finish_reason: null }],
			}),
		);
		expect(chunks.filter((chunk) => chunk.kind === "text-delta")).toEqual([]);
	});

	it("LSA-OC242: finish_reason length maps to finish length", () => {
		expect(
			openaiChatAdapter().parseChunk(
				payload({
					id: "c1",
					object: "chat.completion.chunk",
					choices: [{ index: 0, delta: {}, finish_reason: "length" }],
				}),
			),
		).toContainEqual({ kind: "finish", reason: "length", choiceIndex: 0 });
	});

	it("LSA-OC243: finish_reason tool_calls maps to finish tool_calls", () => {
		expect(
			openaiChatAdapter().parseChunk(
				payload({
					id: "c1",
					object: "chat.completion.chunk",
					choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }],
				}),
			),
		).toContainEqual({ kind: "finish", reason: "tool_calls", choiceIndex: 0 });
	});

	it("LSA-OC244: unknown finish_reason emits provider-error and finish error", () => {
		const chunks = openaiChatAdapter().parseChunk(
			payload({
				id: "c1",
				object: "chat.completion.chunk",
				choices: [{ index: 0, delta: {}, finish_reason: "future_reason" }],
			}),
		);
		expect(chunks.some((chunk) => chunk.kind === "provider-error")).toBe(true);
		expect(chunks).toContainEqual({ kind: "finish", reason: "error", choiceIndex: 0 });
	});

	it("LSA-OC245: delta.reasoning_summary maps to reasoning-delta summary variant", () => {
		expect(
			openaiChatAdapter().parseChunk(
				payload({
					id: "c1",
					object: "chat.completion.chunk",
					choices: [{ index: 0, delta: { reasoning_summary: "brief" }, finish_reason: null }],
				}),
			),
		).toContainEqual({ kind: "reasoning-delta", text: "brief", variant: "summary" });
	});

	it("LSA-OC246: multichoice stream preserves choiceIndex on text deltas", async () => {
		const events = await collectAsync(
			assembleFromPayloads(
				strings(
					payload({
						id: "c1",
						object: "chat.completion.chunk",
						choices: [{ index: 0, delta: { content: "a" }, finish_reason: null }],
					}),
					payload({
						id: "c1",
						object: "chat.completion.chunk",
						choices: [{ index: 1, delta: { content: "b" }, finish_reason: null }],
					}),
					payload({
						id: "c1",
						object: "chat.completion.chunk",
						choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
					}),
				),
				openaiChatAdapter(),
			),
		);
		const text = events.filter((event) => event.type === "text.delta");
		expect(text.map((event) => (event.type === "text.delta" ? event.text : ""))).toEqual([
			"a",
			"b",
		]);
	});

	it("LSA-OC247: duplicate finish_reason stop on second chunk is dropped by assembler", async () => {
		const events = await collectAsync(
			assembleFromPayloads(
				strings(
					payload({
						id: "c1",
						object: "chat.completion.chunk",
						choices: [{ index: 0, delta: { content: "x" }, finish_reason: null }],
					}),
					payload({
						id: "c1",
						object: "chat.completion.chunk",
						choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
					}),
					payload({
						id: "c1",
						object: "chat.completion.chunk",
						choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
					}),
				),
				openaiChatAdapter(),
			),
		);
		expect(events.filter((event) => event.type === "finish")).toHaveLength(1);
	});

	it("LSA-OC248: unicode content delta preserves UTF-8 text", () => {
		expect(
			openaiChatAdapter().parseChunk(
				payload({
					id: "c1",
					object: "chat.completion.chunk",
					choices: [{ index: 0, delta: { content: "čaj 🍵" }, finish_reason: null }],
				}),
			),
		).toContainEqual({ kind: "text-delta", text: "čaj 🍵", choiceIndex: 0 });
	});

	it("LSA-OC249: legacy function_call delta maps to tool-start", () => {
		const chunks = openaiChatAdapter().parseChunk(
			payload({
				id: "c1",
				object: "chat.completion.chunk",
				choices: [
					{
						index: 0,
						delta: { function_call: { name: "lookup", arguments: "" } },
						finish_reason: null,
					},
				],
			}),
		);
		expect(chunks).toContainEqual({
			kind: "tool-start",
			id: "legacy_function:0",
			name: "lookup",
			index: 0,
			choiceIndex: 0,
		});
	});

	it("LSA-OC250: usage chunk before terminal finish is emitted", async () => {
		const events = await collectAsync(
			assembleFromPayloads(
				strings(
					payload({
						id: "c1",
						object: "chat.completion.chunk",
						choices: [{ index: 0, delta: { content: "ok" }, finish_reason: null }],
					}),
					payload({
						id: "c1",
						object: "chat.completion.chunk",
						usage: { prompt_tokens: 3, completion_tokens: 1 },
						choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
					}),
				),
				openaiChatAdapter(),
			),
		);
		expect(events.some((event) => event.type === "usage")).toBe(true);
		expect(events.some((event) => event.type === "finish")).toBe(true);
	});

	it("LSA-OC251: provider-error golden stream matches expected events", async () => {
		const events = normalizeEvents(
			await collectAsync(
				assembleStream(
					byteStreamFromStrings(openAITextFixture("provider-error", "sse")),
					openaiChatAdapter(),
				),
			),
		);
		expect(events).toEqual(expectedOpenAIEvents("provider-error"));
	});

	it("LSA-OC252: finish_reason function_call maps to finish tool_calls", () => {
		expect(
			openaiChatAdapter().parseChunk(
				payload({
					id: "c1",
					object: "chat.completion.chunk",
					choices: [{ index: 0, delta: {}, finish_reason: "function_call" }],
				}),
			),
		).toContainEqual({ kind: "finish", reason: "tool_calls", choiceIndex: 0 });
	});
});
