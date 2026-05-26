import { describe, expect, it } from "vitest";
import { geminiAdapter } from "../src/adapters/gemini";

const payload = (value: unknown) => JSON.stringify(value);

describe("geminiAdapter finish and usage", () => {
	it("LSA-G30: candidate finishReason STOP maps finish stop", () => {
		expect(
			geminiAdapter().parseChunk(
				payload({
					candidates: [{ index: 0, finishReason: "STOP", content: { parts: [] } }],
				}),
			),
		).toContainEqual({ kind: "finish", reason: "stop", choiceIndex: 0 });
	});

	it("LSA-G31: STOP_REASON_UNSPECIFIED maps finish stop", () => {
		expect(
			geminiAdapter().parseChunk(
				payload({
					candidates: [
						{
							index: 0,
							finishReason: "STOP_REASON_UNSPECIFIED",
							content: { parts: [{ text: "x" }] },
						},
					],
				}),
			),
		).toContainEqual({ kind: "finish", reason: "stop", choiceIndex: 0 });
	});

	it("LSA-G32: MAX_TOKENS maps finish length", () => {
		expect(
			geminiAdapter().parseChunk(
				payload({
					candidates: [
						{
							index: 0,
							finishReason: "MAX_TOKENS",
							content: { parts: [{ text: "trunc" }] },
						},
					],
				}),
			),
		).toContainEqual({ kind: "finish", reason: "length", choiceIndex: 0 });
	});

	it("LSA-G33: SPII maps content_filter", () => {
		expect(
			geminiAdapter().parseChunk(
				payload({
					candidates: [{ index: 0, finishReason: "SPII", content: { parts: [] } }],
				}),
			),
		).toContainEqual({ kind: "finish", reason: "content_filter", choiceIndex: 0 });
	});

	it("LSA-G34: usage emits reasoningTokens from thoughtsTokenCount", () => {
		expect(
			geminiAdapter().parseChunk(
				payload({
					usageMetadata: {
						promptTokenCount: 2,
						candidatesTokenCount: 1,
						thoughtsTokenCount: 3,
						totalTokenCount: 6,
					},
				}),
			),
		).toEqual([
			{
				kind: "usage",
				inputTokens: 2,
				outputTokens: 1,
				reasoningTokens: 3,
				raw: {
					promptTokenCount: 2,
					candidatesTokenCount: 1,
					thoughtsTokenCount: 3,
					totalTokenCount: 6,
				},
			},
		]);
	});

	it("LSA-G35: RECITATION finish maps content_filter", () => {
		expect(
			geminiAdapter().parseChunk(
				payload({
					candidates: [{ index: 0, finishReason: "RECITATION", content: { parts: [] } }],
				}),
			),
		).toContainEqual({ kind: "finish", reason: "content_filter", choiceIndex: 0 });
	});
});
