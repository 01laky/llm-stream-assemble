import { describe, expect, it } from "vitest";
import { anthropicAdapter } from "../src/adapters/anthropic";
import { normalizeAnthropicRawChunks } from "./helpers/anthropic-fixtures";

const payload = (value: unknown) => JSON.stringify(value);

describe("anthropicAdapter parseChunk", () => {
	it("LSA-A01: message_start emits message-start metadata and usage", () => {
		const chunks = anthropicAdapter().parseChunk(
			payload({
				type: "message_start",
				message: {
					id: "msg_1",
					model: "claude-3-5-sonnet",
					usage: { input_tokens: 3, output_tokens: 0 },
				},
			}),
		);
		expect(normalizeAnthropicRawChunks(chunks)).toEqual([
			{ kind: "message-start", id: "msg_1" },
			{ kind: "metadata", model: "claude-3-5-sonnet", responseId: "msg_1" },
			{ kind: "usage", inputTokens: 3, outputTokens: 0 },
		]);
	});

	it("LSA-A02: text block start with text emits text-delta", () => {
		expect(
			anthropicAdapter().parseChunk(
				payload({
					type: "content_block_start",
					index: 0,
					content_block: { type: "text", text: "hi" },
				}),
			),
		).toEqual([{ kind: "text-delta", text: "hi" }]);
	});

	it("LSA-A03: text_delta emits text-delta", () => {
		const adapter = anthropicAdapter();
		adapter.parseChunk(
			payload({ type: "content_block_start", index: 0, content_block: { type: "text" } }),
		);
		expect(
			adapter.parseChunk(
				payload({
					type: "content_block_delta",
					index: 0,
					delta: { type: "text_delta", text: "hello" },
				}),
			),
		).toEqual([{ kind: "text-delta", text: "hello" }]);
	});

	it("LSA-A04: thinking_delta emits detail reasoning", () => {
		expect(
			anthropicAdapter().parseChunk(
				payload({
					type: "content_block_delta",
					index: 0,
					delta: { type: "thinking_delta", thinking: "think" },
				}),
			),
		).toEqual([{ kind: "reasoning-delta", text: "think", variant: "detail" }]);
	});

	it("LSA-A05: tool_use start emits tool-start", () => {
		expect(
			anthropicAdapter().parseChunk(
				payload({
					type: "content_block_start",
					index: 2,
					content_block: { type: "tool_use", id: "toolu_1", name: "search", input: {} },
				}),
			),
		).toEqual([{ kind: "tool-start", id: "toolu_1", name: "search", index: 2 }]);
	});

	it("LSA-A06: input_json_delta emits tool args delta using stored tool id", () => {
		const adapter = anthropicAdapter();
		adapter.parseChunk(
			payload({
				type: "content_block_start",
				index: 0,
				content_block: { type: "tool_use", id: "toolu_1", name: "search", input: {} },
			}),
		);
		expect(
			adapter.parseChunk(
				payload({
					type: "content_block_delta",
					index: 0,
					delta: { type: "input_json_delta", partial_json: '{"q":"hi' },
				}),
			),
		).toEqual([{ kind: "tool-args-delta", id: "toolu_1", delta: '{"q":"hi', index: 0 }]);
	});

	it("LSA-A07: content_block_stop emits tool-done for tool blocks only", () => {
		const adapter = anthropicAdapter();
		adapter.parseChunk(
			payload({
				type: "content_block_start",
				index: 0,
				content_block: { type: "tool_use", id: "toolu_1", name: "search", input: {} },
			}),
		);
		expect(adapter.parseChunk(payload({ type: "content_block_stop", index: 0 }))).toEqual([
			{ kind: "tool-done", id: "toolu_1", index: 0 },
		]);
	});

	it("LSA-A08: message_delta maps usage and stop_reason", () => {
		expect(
			anthropicAdapter().parseChunk(
				payload({
					type: "message_delta",
					delta: { stop_reason: "max_tokens" },
					usage: { output_tokens: 9 },
				}),
			),
		).toEqual([
			{ kind: "usage", outputTokens: 9, raw: { output_tokens: 9 } },
			{ kind: "finish", reason: "length" },
		]);
	});

	it("LSA-A09: provider error emits provider-error and finish error", () => {
		expect(
			normalizeAnthropicRawChunks(
				anthropicAdapter().parseChunk(
					payload({ type: "error", error: { type: "overloaded_error", message: "Overloaded" } }),
				),
			),
		).toEqual([
			{ kind: "provider-error", recoverable: false },
			{ kind: "finish", reason: "error" },
		]);
	});

	it("LSA-A10: malformed JSON throws prefixed parser error", () => {
		expect(() => anthropicAdapter().parseChunk("{")).toThrow(
			/^llm-stream-assemble: anthropicAdapter\.parseChunk/,
		);
	});

	it("LSA-A11: ping and signature_delta are ignored", () => {
		const adapter = anthropicAdapter();
		expect(adapter.parseChunk(payload({ type: "ping" }))).toEqual([]);
		expect(
			adapter.parseChunk(
				payload({ type: "content_block_delta", index: 0, delta: { type: "signature_delta" } }),
			),
		).toEqual([]);
	});
});
