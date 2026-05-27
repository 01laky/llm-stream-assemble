import { describe, expect, it } from "vitest";
import { geminiAdapter } from "../src/adapters/gemini";
import { assembleStream } from "../src/core/assemble-stream";
import { byteStreamFromStrings, collectAsync } from "./helpers/collect-events";
import {
	assembleVertexJsonl,
	geminiTextFixture,
	normalizeGeminiEvents,
	vertexJsonlLines,
} from "./helpers/gemini-fixtures";

async function googleAiEvents(name: string, jsonMode = false) {
	return normalizeGeminiEvents(
		await collectAsync(
			assembleStream(
				byteStreamFromStrings(geminiTextFixture(name, "sse")),
				geminiAdapter({ jsonMode }),
			),
		),
	);
}

describe("geminiAdapter google-ai vs vertex parity", () => {
	it("LSA-GV97: text-basic SSE and vertex jsonl yield identical normalized events", async () => {
		const google = await googleAiEvents("text-basic");
		const vertex = normalizeGeminiEvents(await assembleVertexJsonl("text-basic"));
		expect(vertex).toEqual(google);
	});

	it("LSA-GV97b: tool-single parity", async () => {
		expect(normalizeGeminiEvents(await assembleVertexJsonl("tool-single"))).toEqual(
			await googleAiEvents("tool-single"),
		);
	});

	it("LSA-GV97c: thinking parity", async () => {
		expect(normalizeGeminiEvents(await assembleVertexJsonl("thinking"))).toEqual(
			await googleAiEvents("thinking"),
		);
	});

	it("LSA-GV97d: usage-only parity", async () => {
		expect(normalizeGeminiEvents(await assembleVertexJsonl("usage-only"))).toEqual(
			await googleAiEvents("usage-only"),
		);
	});

	it("LSA-GV97e: json-mode parity", async () => {
		expect(
			normalizeGeminiEvents(await assembleVertexJsonl("json-mode", { jsonMode: true })),
		).toEqual(await googleAiEvents("json-mode", true));
	});

	it("LSA-GV98: envelope-wrapped matches text-basic inner mapping", async () => {
		const wrapped = normalizeGeminiEvents(await assembleVertexJsonl("envelope-wrapped"));
		const basic = normalizeGeminiEvents(await assembleVertexJsonl("text-basic"));
		expect(wrapped).toEqual(basic);
	});

	it("LSA-GV99: grounding-metadata emits metadata with raw grounding fields", async () => {
		const events = normalizeGeminiEvents(await assembleVertexJsonl("grounding-metadata"));
		expect(
			events.some((e) => e && typeof e === "object" && "type" in e && e.type === "metadata"),
		).toBe(true);
	});

	it("LSA-GV99b: grounding-chunks fixture assembles without throw", async () => {
		await expect(assembleVertexJsonl("grounding-chunks")).resolves.toBeDefined();
	});

	it("LSA-GV99c: vertex jsonl lines count matches sse data lines for text-basic", () => {
		const sseLines = geminiTextFixture("text-basic", "sse")
			.split("\n")
			.filter((l) => l.trim().startsWith("data:")).length;
		expect(vertexJsonlLines("text-basic").length).toBe(sseLines);
	});
});
