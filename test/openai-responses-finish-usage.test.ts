import { describe, expect, it } from "vitest";
import { openaiResponsesAdapter } from "../src/adapters/openai-responses";

const payload = (value: unknown) => JSON.stringify(value);

describe("openaiResponsesAdapter finish and usage", () => {
	it("LSA-R41: response.completed maps finish stop", () => {
		expect(
			openaiResponsesAdapter().parseChunk(
				payload({ type: "response.completed", response: { id: "resp_1" } }),
			),
		).toContainEqual({ kind: "finish", reason: "stop" });
	});

	it("LSA-R42: response.incomplete maps finish incomplete", () => {
		expect(
			openaiResponsesAdapter().parseChunk(payload({ type: "response.incomplete", response: {} })),
		).toContainEqual({ kind: "finish", reason: "incomplete" });
	});

	it("LSA-R43: response.completed usage maps input and output tokens", () => {
		expect(
			openaiResponsesAdapter().parseChunk(
				payload({
					type: "response.completed",
					response: {
						usage: {
							input_tokens: 11,
							output_tokens: 7,
							output_tokens_details: { reasoning_tokens: 2 },
						},
					},
				}),
			),
		).toContainEqual({
			kind: "usage",
			inputTokens: 11,
			outputTokens: 7,
			reasoningTokens: 2,
			raw: {
				input_tokens: 11,
				output_tokens: 7,
				output_tokens_details: { reasoning_tokens: 2 },
			},
		});
	});

	it("LSA-R44: response.failed maps finish error", () => {
		expect(
			openaiResponsesAdapter().parseChunk(
				payload({
					type: "response.failed",
					response: { error: { message: "fail" } },
				}),
			),
		).toContainEqual({ kind: "finish", reason: "error" });
	});
});
