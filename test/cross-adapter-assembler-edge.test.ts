import { describe, expect, it } from "vitest";
import { anthropicAdapter } from "../src/adapters/anthropic";
import { bedrockAdapter } from "../src/adapters/bedrock";
import { geminiAdapter } from "../src/adapters/gemini";
import { openaiChatAdapter } from "../src/adapters/openai-chat";
import { cohereAdapter } from "../src/adapters/cohere";
import { openaiResponsesAdapter } from "../src/adapters/openai-responses";
import { assembleFromPayloads } from "../src/core/assemble-payloads";
import { collectAsync } from "./helpers/collect-events";

const payload = (value: unknown) => JSON.stringify(value);

describe("cross-adapter assembler edge cases", () => {
	it.each([
		[
			"LSA-X58",
			"bedrock",
			bedrockAdapter(),
			async function* () {
				yield payload({ messageStart: { role: "assistant" } });
				yield payload({
					contentBlockDelta: { contentBlockIndex: 0, delta: { text: "a" } },
				});
				yield payload({ messageStop: { stopReason: "end_turn" } });
				yield payload({ metadata: { trace: { late: true } } });
			},
		],
		[
			"LSA-X59",
			"anthropic",
			anthropicAdapter(),
			async function* () {
				yield payload({
					type: "content_block_delta",
					index: 0,
					delta: { type: "text_delta", text: "a" },
				});
				yield payload({ type: "message_delta", delta: { stop_reason: "end_turn" } });
				yield payload({ type: "message_delta", usage: { input_tokens: 1, output_tokens: 1 } });
			},
		],
		[
			"LSA-X60",
			"gemini",
			geminiAdapter(),
			async function* () {
				yield payload({
					candidates: [{ index: 0, content: { parts: [{ text: "a" }] } }],
				});
				yield payload({
					candidates: [{ index: 0, finishReason: "STOP", content: { parts: [] } }],
				});
				yield payload({ usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1 } });
			},
		],
		[
			"LSA-X61",
			"openai-responses",
			openaiResponsesAdapter(),
			async function* () {
				yield payload({ type: "response.output_text.delta", delta: "a" });
				yield payload({ type: "response.completed", response: {} });
				yield payload({ type: "response.output_text.delta", delta: "late" });
			},
		],
		[
			"LSA-X62",
			"openai-chat",
			openaiChatAdapter(),
			async function* () {
				yield payload({
					id: "cmpl",
					object: "chat.completion.chunk",
					choices: [{ index: 0, delta: { content: "a" }, finish_reason: null }],
				});
				yield payload({
					id: "cmpl",
					object: "chat.completion.chunk",
					choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
				});
				yield payload({
					id: "cmpl",
					object: "chat.completion.chunk",
					choices: [{ index: 0, delta: { content: "late" }, finish_reason: null }],
				});
			},
		],
		[
			"LSA-X63",
			"cohere",
			cohereAdapter(),
			async function* () {
				yield payload({
					type: "message-start",
					id: "m1",
					delta: { message: { role: "assistant" } },
				});
				yield payload({
					type: "content-delta",
					index: 0,
					delta: { message: { content: { text: "a" } } },
				});
				yield payload({
					type: "message-end",
					delta: { finish_reason: "COMPLETE" },
				});
				yield payload({
					type: "citation-start",
					index: 0,
					delta: { message: { citations: { text: "late" } } },
				});
			},
		],
		[
			"LSA-X64",
			"gemini-vertex",
			geminiAdapter({ apiSurface: "vertex" }),
			async function* () {
				yield payload({
					responseId: "v1",
					candidates: [{ index: 0, content: { role: "model", parts: [{ text: "a" }] } }],
				});
				yield payload({
					candidates: [{ index: 0, finishReason: "STOP", content: { role: "model", parts: [] } }],
				});
				yield payload({ usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1 } });
			},
		],
	])(
		"%s: %s drops post-finish adapter chunks during assembly",
		async (_id, _name, adapter, payloads) => {
			const events = await collectAsync(assembleFromPayloads(payloads(), adapter));
			expect(events.some((event) => event.type === "finish")).toBe(true);
			const textEvents = events.filter((event) => event.type === "text.delta");
			expect(textEvents.length).toBeLessThanOrEqual(1);
			if (textEvents[0]?.type === "text.delta") {
				expect(textEvents[0].text).not.toContain("late");
			}
		},
	);

	it.each([
		[
			"LSA-X65",
			openaiChatAdapter({ jsonMode: true }),
			async function* () {
				yield payload({
					id: "cmpl",
					object: "chat.completion.chunk",
					choices: [{ index: 0, delta: { content: '{"a":1}' }, finish_reason: null }],
				});
				yield payload({
					id: "cmpl",
					object: "chat.completion.chunk",
					choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
				});
				yield payload({
					id: "cmpl",
					object: "chat.completion.chunk",
					choices: [{ index: 0, delta: { content: '{"late":true}' }, finish_reason: null }],
				});
			},
		],
		[
			"LSA-X66",
			openaiResponsesAdapter({ jsonMode: true }),
			async function* () {
				yield payload({ type: "response.output_text.delta", delta: '{"x":1}' });
				yield payload({ type: "response.completed", response: {} });
				yield payload({ type: "response.output_text.delta", delta: '{"late":true}' });
			},
		],
		[
			"LSA-X67",
			anthropicAdapter({ jsonMode: true }),
			async function* () {
				yield payload({
					type: "content_block_delta",
					index: 0,
					delta: { type: "text_delta", text: '{"a":1}' },
				});
				yield payload({ type: "message_delta", delta: { stop_reason: "end_turn" } });
				yield payload({
					type: "content_block_delta",
					index: 0,
					delta: { type: "text_delta", text: '{"late":true}' },
				});
			},
		],
		[
			"LSA-X68",
			cohereAdapter({ jsonMode: true }),
			async function* () {
				yield payload({
					type: "message-start",
					id: "m1",
					delta: { message: { role: "assistant" } },
				});
				yield payload({
					type: "content-delta",
					index: 0,
					delta: { message: { content: { text: '{"a":1}' } } },
				});
				yield payload({
					type: "message-end",
					delta: { finish_reason: "COMPLETE" },
				});
				yield payload({
					type: "content-delta",
					index: 0,
					delta: { message: { content: { text: '{"late":true}' } } },
				});
			},
		],
		[
			"LSA-X69",
			bedrockAdapter({ jsonMode: true }),
			async function* () {
				yield payload({ messageStart: { role: "assistant" } });
				yield payload({
					contentBlockDelta: { contentBlockIndex: 0, delta: { text: '{"a":1}' } },
				});
				yield payload({ messageStop: { stopReason: "end_turn" } });
				yield payload({
					contentBlockDelta: { contentBlockIndex: 0, delta: { text: '{"late":true}' } },
				});
			},
		],
		[
			"LSA-X70",
			geminiAdapter({ jsonMode: true }),
			async function* () {
				yield payload({
					candidates: [{ index: 0, content: { parts: [{ text: '{"a":1}' }] } }],
				});
				yield payload({
					candidates: [{ index: 0, finishReason: "STOP", content: { parts: [] } }],
				});
				yield payload({
					candidates: [{ index: 0, content: { parts: [{ text: '{"late":true}' }] } }],
				});
			},
		],
	])("%s: jsonMode drops post-finish json deltas", async (_id, adapter, payloads) => {
		const events = await collectAsync(assembleFromPayloads(payloads(), adapter));
		expect(events.some((event) => event.type === "finish")).toBe(true);
		expect(
			events.some((event) => event.type === "json.delta" && event.delta.includes("late")),
		).toBe(false);
		expect(events.filter((event) => event.type === "json.delta").length).toBeLessThanOrEqual(1);
	});

	it("LSA-X71: strictToolArgs throws on invalid OpenAI Chat tool JSON at stream end", async () => {
		async function* payloads() {
			yield payload({
				id: "cmpl",
				object: "chat.completion.chunk",
				choices: [
					{
						index: 0,
						delta: {
							tool_calls: [{ index: 0, id: "call_1", function: { name: "fn", arguments: "{" } }],
						},
						finish_reason: null,
					},
				],
			});
			yield payload({
				id: "cmpl",
				object: "chat.completion.chunk",
				choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }],
			});
		}
		await expect(
			collectAsync(assembleFromPayloads(payloads(), openaiChatAdapter(), { strictToolArgs: true })),
		).rejects.toThrow(/^llm-stream-assemble:/);
	});

	it("LSA-X72: strictToolArgs throws on invalid Anthropic tool input at stream end", async () => {
		async function* payloads() {
			yield payload({
				type: "content_block_start",
				index: 0,
				content_block: { type: "tool_use", id: "toolu_1", name: "get_weather" },
			});
			yield payload({
				type: "content_block_delta",
				index: 0,
				delta: { type: "input_json_delta", partial_json: "{" },
			});
			yield payload({ type: "message_delta", delta: { stop_reason: "tool_use" } });
		}
		await expect(
			collectAsync(assembleFromPayloads(payloads(), anthropicAdapter(), { strictToolArgs: true })),
		).rejects.toThrow(/^llm-stream-assemble:/);
	});

	it("LSA-X73: strictToolArgs throws on invalid Bedrock tool input at stream end", async () => {
		async function* payloads() {
			yield payload({
				contentBlockStart: {
					contentBlockIndex: 0,
					start: { toolUse: { toolUseId: "t1", name: "search" } },
				},
			});
			yield payload({
				contentBlockDelta: {
					contentBlockIndex: 0,
					delta: { toolUse: { input: "{" } },
				},
			});
			yield payload({ contentBlockStop: { contentBlockIndex: 0 } });
			yield payload({ messageStop: { stopReason: "tool_use" } });
		}
		await expect(
			collectAsync(assembleFromPayloads(payloads(), bedrockAdapter(), { strictToolArgs: true })),
		).rejects.toThrow(/^llm-stream-assemble:/);
	});

	it("LSA-X74: strictToolArgs throws on invalid Cohere tool args at stream end", async () => {
		async function* payloads() {
			yield payload({
				type: "message-start",
				id: "m1",
				delta: { message: { role: "assistant" } },
			});
			yield payload({
				type: "tool-call-start",
				index: 0,
				delta: {
					message: {
						tool_calls: {
							type: "function",
							function: { name: "fn", arguments: "" },
						},
					},
				},
			});
			yield payload({
				type: "tool-call-delta",
				index: 0,
				delta: {
					message: {
						tool_calls: {
							function: { arguments: "{" },
						},
					},
				},
			});
			yield payload({ type: "tool-call-end", index: 0 });
			yield payload({
				type: "message-end",
				delta: { finish_reason: "TOOL_CALL" },
			});
		}
		await expect(
			collectAsync(assembleFromPayloads(payloads(), cohereAdapter(), { strictToolArgs: true })),
		).rejects.toThrow(/^llm-stream-assemble:/);
	});

	it("LSA-X75: strictToolArgs throws on invalid Gemini functionCall args at stream end", async () => {
		async function* payloads() {
			yield payload({
				candidates: [
					{
						index: 0,
						content: {
							parts: [
								{
									functionCall: {
										name: "fn",
										partialArgs: [{ json: "{" }],
									},
								},
							],
						},
					},
				],
			});
			yield payload({
				candidates: [{ index: 0, finishReason: "STOP", content: { parts: [] } }],
			});
		}
		await expect(
			collectAsync(assembleFromPayloads(payloads(), geminiAdapter(), { strictToolArgs: true })),
		).rejects.toThrow(/^llm-stream-assemble:/);
	});

	it("LSA-X76: strictToolArgs throws on invalid OpenAI Responses tool args at stream end", async () => {
		async function* payloads() {
			yield payload({
				type: "response.output_item.added",
				output_index: 0,
				item: { type: "function_call", id: "call_x", name: "search", call_id: "call_x" },
			});
			yield payload({
				type: "response.function_call_arguments.delta",
				output_index: 0,
				call_id: "call_x",
				delta: "{",
			});
			yield payload({ type: "response.completed", response: {} });
		}
		await expect(
			collectAsync(
				assembleFromPayloads(payloads(), openaiResponsesAdapter(), { strictToolArgs: true }),
			),
		).rejects.toThrow(/^llm-stream-assemble:/);
	});
});
