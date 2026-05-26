import { describe, expect, it } from "vitest";
import { geminiAdapter } from "../src/adapters/gemini";

/** Locks in Gemini ↔ unified mapping described in docs/post-1.0-provider-roadmap.md */

const payload = (value: unknown) => JSON.stringify(value);

describe("Gemini adapter docs mapping regression", () => {
	it("LSA-G64: responseId + modelVersion produce message-start and metadata", () => {
		expect(
			geminiAdapter().parseChunk(
				payload({
					responseId: "doc_r",
					modelVersion: "gemini-doc",
					candidates: [],
				}),
			),
		).toEqual([
			{ kind: "message-start", id: "doc_r" },
			{
				kind: "metadata",
				responseId: "doc_r",
				model: "gemini-doc",
				raw: { responseId: "doc_r", modelVersion: "gemini-doc" },
			},
		]);
	});

	it("LSA-G65: text parts become text-delta raw chunks", () => {
		expect(
			geminiAdapter().parseChunk(
				payload({
					candidates: [{ index: 0, content: { parts: [{ text: "body" }] } }],
				}),
			),
		).toEqual([{ kind: "text-delta", text: "body", choiceIndex: 0 }]);
	});

	it("LSA-G66: functionCall maps to tool-start and tool-args lifecycle", () => {
		const chunks = geminiAdapter().parseChunk(
			payload({
				candidates: [
					{
						index: 0,
						content: {
							parts: [{ functionCall: { name: "doc_tool", id: "call_doc", args: { n: 1 } } }],
						},
					},
				],
			}),
		);
		expect(chunks.map((c) => c.kind)).toEqual(["tool-start", "tool-args-delta", "tool-done"]);
	});

	it("LSA-G67: jsonMode routes text through json-delta", () => {
		expect(
			geminiAdapter({ jsonMode: true }).parseChunk(
				payload({ candidates: [{ content: { parts: [{ text: "{}" }] } }] }),
			),
		).toEqual([{ kind: "json-delta", delta: "{}" }]);
	});

	it("LSA-G68: thought parts map to reasoning-delta with detail variant", () => {
		expect(
			geminiAdapter().parseChunk(
				payload({
					candidates: [{ content: { parts: [{ thought: true, text: "silent plan" }] } }],
				}),
			),
		).toEqual([{ kind: "reasoning-delta", text: "silent plan", variant: "detail" }]);
	});

	it("LSA-G69: usageMetadata maps prompt and candidate token counts onto usage chunks", () => {
		const chunks = geminiAdapter().parseChunk(
			payload({
				usageMetadata: { promptTokenCount: 11, candidatesTokenCount: 3, totalTokenCount: 14 },
			}),
		);
		expect(chunks).toHaveLength(1);
		expect(chunks[0]?.kind).toBe("usage");
		expect(chunks[0]).toMatchObject({
			inputTokens: 11,
			outputTokens: 3,
		});
	});

	it("LSA-G70: stream-level safety finish emits content_filter finish chunks", () => {
		expect(
			geminiAdapter().parseChunk(
				payload({
					candidates: [{ index: 0, finishReason: "BLOCKLIST", content: { parts: [] } }],
				}),
			),
		).toContainEqual({ kind: "finish", reason: "content_filter", choiceIndex: 0 });
	});
});
