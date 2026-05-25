import { describe, expect, it } from "vitest";
import { openaiChatAdapter } from "../src/adapters/openai-chat";
import { normalizeRawChunks } from "./helpers/openai-fixtures";

const payload = (value: unknown) => JSON.stringify(value);

describe("openaiChatAdapter finish and usage", () => {
	it("LSA-O21: maps stop finish reason", () => {
		expect(
			openaiChatAdapter().parseChunk(payload({ choices: [{ index: 0, finish_reason: "stop" }] })),
		).toEqual([{ kind: "finish", reason: "stop", choiceIndex: 0 }]);
	});

	it("LSA-O22: maps length finish reason", () => {
		expect(
			openaiChatAdapter().parseChunk(payload({ choices: [{ index: 0, finish_reason: "length" }] })),
		).toEqual([{ kind: "finish", reason: "length", choiceIndex: 0 }]);
	});

	it("LSA-O23: maps content_filter finish reason", () => {
		expect(
			openaiChatAdapter().parseChunk(
				payload({ choices: [{ index: 0, finish_reason: "content_filter" }] }),
			),
		).toEqual([{ kind: "finish", reason: "content_filter", choiceIndex: 0 }]);
	});

	it("LSA-O24: unknown finish reason emits provider error and finish error", () => {
		expect(
			normalizeRawChunks(
				openaiChatAdapter().parseChunk(
					payload({ choices: [{ index: 0, finish_reason: "mystery" }] }),
				),
			),
		).toEqual([
			{ kind: "provider-error", recoverable: true },
			{ kind: "finish", reason: "error", choiceIndex: 0 },
		]);
	});

	it("LSA-O25: maps prompt and completion usage tokens", () => {
		expect(
			normalizeRawChunks(
				openaiChatAdapter().parseChunk(
					payload({ choices: [], usage: { prompt_tokens: 3, completion_tokens: 4 } }),
				),
			),
		).toEqual([{ kind: "usage", inputTokens: 3, outputTokens: 4 }]);
	});

	it("LSA-O26: maps reasoning token usage", () => {
		expect(
			normalizeRawChunks(
				openaiChatAdapter().parseChunk(
					payload({
						choices: [],
						usage: {
							completion_tokens_details: { reasoning_tokens: 7 },
						},
					}),
				),
			),
		).toEqual([{ kind: "usage", reasoningTokens: 7 }]);
	});

	it("LSA-O27: usage-only chunk with empty choices still emits usage", () => {
		expect(
			normalizeRawChunks(
				openaiChatAdapter().parseChunk(
					payload({ choices: [], usage: { prompt_tokens: 1, completion_tokens: 2 } }),
				),
			),
		).toEqual([{ kind: "usage", inputTokens: 1, outputTokens: 2 }]);
	});
});
