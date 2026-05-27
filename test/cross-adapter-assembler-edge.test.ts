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
});
