import { describe, expect, it } from "vitest";
import { geminiAdapter } from "../src/adapters/gemini";
import {
	assembleVertexJsonl,
	expectedVertexEvents,
	normalizeGeminiEvents,
} from "./helpers/gemini-fixtures";

const vertex = () => geminiAdapter({ apiSurface: "vertex" });
const payload = (value: unknown) => JSON.stringify(value);

describe("geminiAdapter vertex finish and usage golden streams", () => {
	const fixtures = [
		["finish-max-tokens", "LSA-GV61"],
		["finish-safety", "LSA-GV62"],
		["usage-only", "LSA-GV63"],
		["metadata-early", "LSA-GV64"],
	] as const;

	it.each(fixtures)("%s matches expected events (%s)", async (name) => {
		const jsonMode = false;
		expect(normalizeGeminiEvents(await assembleVertexJsonl(name, { jsonMode }))).toEqual(
			expectedVertexEvents(name),
		);
	});
});

describe("geminiAdapter vertex parseChunk finish and usage", () => {
	it("LSA-GV65: candidate MAX_TOKENS maps finish length", () => {
		expect(
			vertex().parseChunk(
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

	it("LSA-GV66: SAFETY finish maps content_filter", () => {
		expect(
			vertex().parseChunk(
				payload({
					candidates: [{ index: 0, finishReason: "SAFETY", content: { parts: [] } }],
				}),
			),
		).toContainEqual({ kind: "finish", reason: "content_filter", choiceIndex: 0 });
	});

	it("LSA-GV67: usageMetadata emits reasoningTokens from thoughtsTokenCount", () => {
		expect(
			vertex().parseChunk(
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

	it("LSA-GV68: STOP finish maps stop", () => {
		expect(
			vertex().parseChunk(
				payload({
					candidates: [{ index: 0, finishReason: "STOP", content: { parts: [] } }],
				}),
			),
		).toContainEqual({ kind: "finish", reason: "stop", choiceIndex: 0 });
	});

	it("LSA-GV69: wrapped response usage chunk normalizes before usage mapping", () => {
		const chunks = vertex().parseChunk(
			payload({
				response: {
					usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 7 },
				},
			}),
		);
		expect(
			chunks.some((c) => c.kind === "usage" && c.inputTokens === 5 && c.outputTokens === 7),
		).toBe(true);
	});

	it("LSA-GV70: RECITATION finish maps content_filter on vertex surface", () => {
		expect(
			vertex().parseChunk(
				payload({
					candidates: [{ index: 0, finishReason: "RECITATION", content: { parts: [] } }],
				}),
			),
		).toContainEqual({ kind: "finish", reason: "content_filter", choiceIndex: 0 });
	});
});
