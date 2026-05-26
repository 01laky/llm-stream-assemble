import { describe, expect, it } from "vitest";
import { geminiAdapter } from "../src/adapters/gemini";
import type { StreamAdapter } from "../src/core/types";

const payload = (value: unknown) => JSON.stringify(value);

describe("geminiAdapter parseChunk", () => {
	it("LSA-G01: exported factory returns StreamAdapter", () => {
		const adapter = geminiAdapter();
		expect(typeof adapter.parseChunk).toBe("function");
		expect(typeof adapter.parseResponse).toBe("function");
	});

	it("LSA-G02: empty / whitespace payload returns []", () => {
		expect(geminiAdapter().parseChunk("")).toEqual([]);
		expect(geminiAdapter().parseChunk("   ")).toEqual([]);
	});

	it("LSA-G03: malformed JSON throws prefixed geminiAdapter.parseChunk error", () => {
		expect(() => geminiAdapter().parseChunk("{")).toThrow(/geminiAdapter\.parseChunk/);
	});

	it("LSA-G04: non-object JSON throws prefixed error", () => {
		expect(() => geminiAdapter().parseChunk("[]")).toThrow(
			/geminiAdapter\.parseChunk expected a JSON object/,
		);
	});

	it("LSA-G05: [DONE] returns [] for proxy compatibility", () => {
		expect(geminiAdapter().parseChunk("[DONE]")).toEqual([]);
	});

	it("LSA-G06: text part maps text-delta", () => {
		expect(
			geminiAdapter().parseChunk(
				payload({
					candidates: [{ content: { parts: [{ text: "Hello" }] } }],
				}),
			),
		).toEqual([{ kind: "text-delta", text: "Hello", choiceIndex: 0 }]);
	});

	it("LSA-G07: empty text skipped", () => {
		expect(
			geminiAdapter().parseChunk(
				payload({ candidates: [{ content: { parts: [{ text: "" }] } }] }),
			),
		).toEqual([]);
	});

	it("LSA-G08: unicode preserved in text-delta", () => {
		expect(
			geminiAdapter().parseChunk(
				payload({ candidates: [{ content: { parts: [{ text: "🌍 你好" }] } }] }),
			),
		).toEqual([{ kind: "text-delta", text: "🌍 你好", choiceIndex: 0 }]);
	});

	it("LSA-G09: jsonMode maps text to json-delta", () => {
		expect(
			geminiAdapter({ jsonMode: true }).parseChunk(
				payload({ candidates: [{ content: { parts: [{ text: '{"a":1}' }] } }] }),
			),
		).toEqual([{ kind: "json-delta", delta: '{"a":1}' }]);
	});

	it("LSA-G10: responseId and modelVersion emit message-start and metadata", () => {
		expect(
			geminiAdapter().parseChunk(
				payload({
					responseId: "resp_1",
					modelVersion: "gemini-2.5-flash",
					candidates: [{ content: { parts: [{ text: "Hi" }] } }],
				}),
			),
		).toEqual([
			{ kind: "message-start", id: "resp_1" },
			{
				kind: "metadata",
				responseId: "resp_1",
				model: "gemini-2.5-flash",
				raw: { responseId: "resp_1", modelVersion: "gemini-2.5-flash" },
			},
			{ kind: "text-delta", text: "Hi", choiceIndex: 0 },
		]);
	});

	it("LSA-G11: metadata not duplicated on subsequent chunks", () => {
		const adapter = geminiAdapter();
		adapter.parseChunk(payload({ responseId: "r1", modelVersion: "gemini-2.5-flash" }));
		expect(adapter.parseChunk(payload({ candidates: [{ content: { parts: [{ text: "x" }] } }] }))).toEqual([
			{ kind: "text-delta", text: "x", choiceIndex: 0 },
		]);
	});

	it("LSA-G12: usageMetadata maps input and output tokens", () => {
		expect(
			geminiAdapter().parseChunk(
				payload({
					usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 4, totalTokenCount: 14 },
				}),
			),
		).toEqual([
			{
				kind: "usage",
				inputTokens: 10,
				outputTokens: 4,
				raw: { promptTokenCount: 10, candidatesTokenCount: 4, totalTokenCount: 14 },
			},
		]);
	});

	it("LSA-G13: usage-only chunk with no candidates emits usage", () => {
		const chunks = geminiAdapter().parseChunk(
			payload({ usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 0, totalTokenCount: 1 } }),
		);
		expect(chunks).toHaveLength(1);
		expect(chunks[0]?.kind).toBe("usage");
	});

	it("LSA-G14: empty candidates array returns []", () => {
		expect(geminiAdapter().parseChunk(payload({ candidates: [] }))).toEqual([]);
	});

	it("LSA-G15: missing candidates key tolerated", () => {
		expect(geminiAdapter().parseChunk(payload({ responseId: "only_meta" }))).toEqual([
			{ kind: "message-start", id: "only_meta" },
			{ kind: "metadata", responseId: "only_meta", raw: { responseId: "only_meta", modelVersion: undefined } },
		]);
	});

	it("LSA-G16: thought part maps reasoning detail delta", () => {
		expect(
			geminiAdapter().parseChunk(
				payload({ candidates: [{ content: { parts: [{ thought: true, text: "thinking" }] } }] }),
			),
		).toEqual([{ kind: "reasoning-delta", text: "thinking", variant: "detail" }]);
	});

	it("LSA-G17: thought part without text ignored", () => {
		expect(
			geminiAdapter().parseChunk(
				payload({ candidates: [{ content: { parts: [{ thought: true }] } }] }),
			),
		).toEqual([]);
	});

	it("LSA-G18: unknown part type ignored without throw", () => {
		expect(
			geminiAdapter().parseChunk(
				payload({ candidates: [{ content: { parts: [{ customField: "x" }] } }] }),
			),
		).toEqual([]);
	});

	it("LSA-G19: multimodal parts ignored", () => {
		expect(
			geminiAdapter().parseChunk(
				payload({
					candidates: [
						{
							content: {
								parts: [{ inlineData: { mimeType: "image/png", data: "abc" } }, { fileData: { fileUri: "x" } }],
							},
						},
					],
				}),
			),
		).toEqual([]);
	});

	it("LSA-G20: functionResponse part ignored", () => {
		expect(
			geminiAdapter().parseChunk(
				payload({
					candidates: [
						{
							content: {
								parts: [{ functionResponse: { name: "tool", response: { ok: true } } }],
							},
						},
					],
				}),
			),
		).toEqual([]);
	});

	it("LSA-G01b: satisfies StreamAdapter", () => {
		const adapter: StreamAdapter = geminiAdapter();
		expect(adapter).toBeDefined();
	});
});
