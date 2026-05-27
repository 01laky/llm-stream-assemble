import { describe, expect, it } from "vitest";
import { anthropicAdapter } from "../src/adapters/anthropic";

const payload = (value: unknown) => JSON.stringify(value);

describe("anthropicAdapter finish and usage", () => {
	it("LSA-A27: message_delta end_turn maps finish stop", () => {
		expect(
			anthropicAdapter().parseChunk(
				payload({ type: "message_delta", delta: { stop_reason: "end_turn" } }),
			),
		).toContainEqual({ kind: "finish", reason: "stop" });
	});

	it("LSA-A28: message_delta stop_sequence maps finish stop", () => {
		expect(
			anthropicAdapter().parseChunk(
				payload({ type: "message_delta", delta: { stop_reason: "stop_sequence" } }),
			),
		).toContainEqual({ kind: "finish", reason: "stop" });
	});

	it("LSA-A29: message_delta max_tokens maps finish length", () => {
		expect(
			anthropicAdapter().parseChunk(
				payload({ type: "message_delta", delta: { stop_reason: "max_tokens" } }),
			),
		).toContainEqual({ kind: "finish", reason: "length" });
	});

	it("LSA-A30: message_delta tool_use maps finish tool_calls", () => {
		expect(
			anthropicAdapter().parseChunk(
				payload({ type: "message_delta", delta: { stop_reason: "tool_use" } }),
			),
		).toContainEqual({ kind: "finish", reason: "tool_calls" });
	});

	it("LSA-A31: message_delta refusal maps finish content_filter", () => {
		expect(
			anthropicAdapter().parseChunk(
				payload({ type: "message_delta", delta: { stop_reason: "refusal" } }),
			),
		).toContainEqual({ kind: "finish", reason: "content_filter" });
	});

	it("LSA-A32: message_start usage maps input and output tokens", () => {
		expect(
			anthropicAdapter().parseChunk(
				payload({
					type: "message_start",
					message: {
						id: "msg_1",
						model: "claude",
						usage: { input_tokens: 10, output_tokens: 4 },
					},
				}),
			),
		).toContainEqual({
			kind: "usage",
			inputTokens: 10,
			outputTokens: 4,
			raw: { input_tokens: 10, output_tokens: 4 },
		});
	});

	it("LSA-A33: message_delta usage emits usage chunk", () => {
		expect(
			anthropicAdapter().parseChunk(
				payload({
					type: "message_delta",
					usage: { input_tokens: 5, output_tokens: 2 },
					delta: { stop_reason: "end_turn" },
				}),
			),
		).toContainEqual({
			kind: "usage",
			inputTokens: 5,
			outputTokens: 2,
			raw: { input_tokens: 5, output_tokens: 2 },
		});
	});
});
