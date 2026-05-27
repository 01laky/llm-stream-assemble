import { describe, expect, it } from "vitest";
import { geminiAdapter, normalizeVertexChunk } from "../src/adapters/gemini";
import { assembleResponse } from "../src/core/assemble-response";
import { geminiTextFixture, vertexJSONFixture, vertexJsonlLines } from "./helpers/gemini-fixtures";

describe("geminiAdapter vertex parseChunk", () => {
	it("LSA-GV01: default google-ai adapter parses existing text-basic sse payload", () => {
		const line = geminiTextFixture("text-basic", "sse")
			.split("\n")[0]
			.replace(/^data:\s*/, "");
		const chunks = geminiAdapter().parseChunk(line);
		expect(chunks.some((c) => c.kind === "text-delta")).toBe(true);
	});

	it("LSA-GV02: apiSurface vertex parses google-shaped inner payload same as google-ai", () => {
		const line = vertexJsonlLines("text-basic")[0];
		const google = geminiAdapter().parseChunk(line);
		const vertex = geminiAdapter({ apiSurface: "vertex" }).parseChunk(line);
		expect(vertex).toEqual(google);
	});

	it("LSA-GV03: normalizeVertexChunk strips response wrapper", () => {
		const inner = { responseId: "r1", candidates: [] };
		expect(normalizeVertexChunk({ response: inner })).toEqual(inner);
	});

	it("LSA-GV04: normalizeVertexChunk strips result wrapper", () => {
		const inner = { responseId: "r2" };
		expect(normalizeVertexChunk({ result: inner })).toEqual(inner);
	});

	it("LSA-GV05: normalizeVertexChunk returns null for unknown envelope", () => {
		expect(normalizeVertexChunk({ vertexTraceId: "t1" })).toBeNull();
	});

	it("LSA-GV06: unknown vertex envelope maps to metadata.raw forward compat", () => {
		const chunks = geminiAdapter({ apiSurface: "vertex" }).parseChunk(
			JSON.stringify({ vertexTraceId: "trace-1", status: "OK" }),
		);
		expect(chunks).toHaveLength(1);
		expect(chunks[0]?.kind).toBe("metadata");
	});

	it("LSA-GV07: envelope-wrapped jsonl line parses text deltas", () => {
		const line = JSON.stringify({
			response: JSON.parse(vertexJsonlLines("text-basic")[0]),
		});
		const chunks = geminiAdapter({ apiSurface: "vertex" }).parseChunk(line);
		expect(chunks.some((c) => c.kind === "text-delta")).toBe(true);
	});

	it("LSA-GV08: exported GeminiApiSurface type via factory options", () => {
		expect(geminiAdapter({ apiSurface: "vertex" }).parseChunk).toBeTypeOf("function");
	});

	it("LSA-GV09: empty payload returns []", () => {
		expect(geminiAdapter({ apiSurface: "vertex" }).parseChunk("   ")).toEqual([]);
	});

	it("LSA-GV10: [DONE] returns []", () => {
		expect(geminiAdapter({ apiSurface: "vertex" }).parseChunk("[DONE]")).toEqual([]);
	});

	it("LSA-GV11: normalizeVertexChunk strips predictions[0] wrapper", () => {
		const inner = { responseId: "p1", candidates: [] };
		expect(normalizeVertexChunk({ predictions: [inner] })).toEqual(inner);
	});

	it("LSA-GV12: vertex response wrapper preserves inner candidates", () => {
		const chunks = geminiAdapter({ apiSurface: "vertex" }).parseChunk(
			JSON.stringify({
				response: {
					responseId: "r12",
					candidates: [{ index: 0, content: { parts: [{ text: "wrapped" }] } }],
				},
			}),
		);
		expect(chunks.some((c) => c.kind === "text-delta" && c.text === "wrapped")).toBe(true);
	});

	it("LSA-GV13: vertex error object maps provider error chunks", () => {
		const chunks = geminiAdapter({ apiSurface: "vertex" }).parseChunk(
			JSON.stringify({ error: { message: "quota", code: 429 } }),
		);
		expect(chunks.some((c) => c.kind === "provider-error")).toBe(true);
	});

	it("LSA-GV14: promptFeedback blockReason maps error", () => {
		const chunks = geminiAdapter({ apiSurface: "vertex" }).parseChunk(
			JSON.stringify({ promptFeedback: { blockReason: "SAFETY" } }),
		);
		expect(chunks.some((c) => c.kind === "provider-error")).toBe(true);
	});

	it("LSA-GV15: modelVersion emits metadata chunk", () => {
		const chunks = geminiAdapter({ apiSurface: "vertex" }).parseChunk(
			JSON.stringify({ responseId: "m1", modelVersion: "gemini-2.5-flash" }),
		);
		expect(chunks.some((c) => c.kind === "metadata" && c.model === "gemini-2.5-flash")).toBe(true);
	});

	it("LSA-GV16: usageMetadata-only chunk emits usage", () => {
		const chunks = geminiAdapter({ apiSurface: "vertex" }).parseChunk(
			JSON.stringify({ usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 2 } }),
		);
		expect(chunks).toEqual([
			{
				kind: "usage",
				inputTokens: 1,
				outputTokens: 2,
				raw: { promptTokenCount: 1, candidatesTokenCount: 2 },
			},
		]);
	});

	it("LSA-GV17: invalid JSON throws adapter-scoped parse error", () => {
		expect(() => geminiAdapter({ apiSurface: "vertex" }).parseChunk("{not-json")).toThrow(
			/^llm-stream-assemble: geminiAdapter\.parseChunk:/,
		);
	});

	it("LSA-GV18: wrapped functionCall in vertex response parses tool-start", () => {
		const chunks = geminiAdapter({ apiSurface: "vertex" }).parseChunk(
			JSON.stringify({
				response: {
					candidates: [
						{
							index: 0,
							content: { parts: [{ functionCall: { name: "fn", id: "t1" } }] },
						},
					],
				},
			}),
		);
		expect(chunks).toContainEqual({
			kind: "tool-start",
			id: "t1",
			name: "fn",
			index: 0,
			choiceIndex: 0,
		});
	});

	it("LSA-GV19: empty candidates array yields no text deltas", () => {
		const chunks = geminiAdapter({ apiSurface: "vertex" }).parseChunk(
			JSON.stringify({ responseId: "e1", candidates: [] }),
		);
		expect(chunks.some((c) => c.kind === "text-delta")).toBe(false);
	});

	it("LSA-GV20: nested response wrapper unwraps once", () => {
		const inner = { responseId: "n1", candidates: [] };
		expect(normalizeVertexChunk({ response: { response: inner } })).toEqual({ response: inner });
	});

	it("LSA-GV21: missing candidates key still returns metadata when responseId present", () => {
		const chunks = geminiAdapter({ apiSurface: "vertex" }).parseChunk(
			JSON.stringify({ responseId: "only-id" }),
		);
		expect(chunks.some((c) => c.kind === "message-start")).toBe(true);
	});

	it("LSA-GV22: whitespace-only payload returns []", () => {
		expect(geminiAdapter({ apiSurface: "vertex" }).parseChunk("  \n\t  ")).toEqual([]);
	});

	it("LSA-GV23: default adapter apiSurface behaves as google-ai on sse line", () => {
		const line = geminiTextFixture("text-basic", "sse")
			.split("\n")[0]
			.replace(/^data:\s*/, "");
		expect(geminiAdapter().parseChunk(line)).toEqual(
			geminiAdapter({ apiSurface: "google-ai" }).parseChunk(line),
		);
	});

	it("LSA-GV24: normalizeVertexChunk is exported from gemini module", async () => {
		const mod = await import("../src/adapters/gemini");
		expect(mod.normalizeVertexChunk).toBeTypeOf("function");
	});

	it("LSA-GV25: parseResponse honors vertex apiSurface on response JSON", () => {
		const events = assembleResponse(
			vertexJSONFixture("response-text"),
			geminiAdapter({ apiSurface: "vertex" }),
		);
		expect(events.length).toBeGreaterThan(0);
		expect(events.some((e) => e.type === "text.delta")).toBe(true);
	});
});
