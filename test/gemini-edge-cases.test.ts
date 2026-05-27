import { describe, expect, it } from "vitest";
import { geminiAdapter } from "../src/adapters/gemini";
import { assembleFromPayloads } from "../src/core/assemble-payloads";
import { assembleStream } from "../src/core/assemble-stream";
import { byteStreamFromStrings, collectAsync } from "./helpers/collect-events";
import {
	expectedGeminiEvents,
	geminiTextFixture,
	normalizeGeminiEvents,
} from "./helpers/gemini-fixtures";

const payload = (value: unknown) => JSON.stringify(value);

describe("geminiAdapter edge cases", () => {
	it("LSA-G59: citationMetadata and groundingMetadata emit metadata raw payloads", () => {
		expect(
			geminiAdapter().parseChunk(
				payload({
					candidates: [
						{
							index: 0,
							citationMetadata: { citations: [{ uri: "urn:x" }] },
							groundingMetadata: { groundingChunks: [{ web: { uri: "https://example.com" } }] },
							content: { parts: [] },
						},
					],
				}),
			),
		).toEqual([
			{
				kind: "metadata",
				raw: {
					citationMetadata: { citations: [{ uri: "urn:x" }] },
					groundingMetadata: { groundingChunks: [{ web: { uri: "https://example.com" } }] },
				},
			},
		]);
	});

	it("LSA-G60: executableCode and codeExecutionResult parts are skipped", () => {
		expect(
			geminiAdapter().parseChunk(
				payload({
					candidates: [
						{
							index: 0,
							content: {
								parts: [{ executableCode: { language: "PYTHON", code: "print(1)" } }],
							},
						},
					],
				}),
			),
		).toEqual([]);

		expect(
			geminiAdapter().parseChunk(
				payload({
					candidates: [
						{
							index: 0,
							content: {
								parts: [{ codeExecutionResult: { outcome: "OUTCOME_OK", output: "1" } }],
							},
						},
					],
				}),
			),
		).toEqual([]);
	});

	it("LSA-G61: MALFORMED_FUNCTION_CALL emits provider error chunks plus finish slice", () => {
		const chunks = geminiAdapter().parseChunk(
			payload({
				candidates: [
					{
						index: 0,
						finishReason: "MALFORMED_FUNCTION_CALL",
						content: { parts: [] },
					},
				],
			}),
		);
		expect(chunks).toHaveLength(2);
		const first = chunks[0];
		expect(first?.kind).toBe("provider-error");
		if (first?.kind === "provider-error") {
			expect(first.error.message).toMatch(/MALFORMED_FUNCTION_CALL/);
			expect(first.recoverable).toBe(false);
		}
		expect(chunks[1]).toEqual({ kind: "finish", reason: "error" });
	});

	it("LSA-G62: non-zero candidate index forwarded on text deltas", () => {
		expect(
			geminiAdapter().parseChunk(
				payload({
					candidates: [{ index: 2, content: { parts: [{ text: "branch" }] } }],
				}),
			),
		).toEqual([{ kind: "text-delta", text: "branch", choiceIndex: 2 }]);
	});

	it("LSA-G63: tool-parallel.sse matches expected assembleStream events", async () => {
		const events = normalizeGeminiEvents(
			await collectAsync(
				assembleStream(
					byteStreamFromStrings(geminiTextFixture("tool-parallel", "sse")),
					geminiAdapter(),
				),
			),
		);
		expect(events).toEqual(expectedGeminiEvents("tool-parallel"));
	});

	it("LSA-G64: empty or whitespace line yields no chunks", () => {
		expect(geminiAdapter().parseChunk("")).toEqual([]);
		expect(geminiAdapter().parseChunk("  ")).toEqual([]);
	});

	it("LSA-G65: [DONE] marker yields no chunks", () => {
		expect(geminiAdapter().parseChunk("[DONE]")).toEqual([]);
	});

	it("LSA-G66: non-object JSON throws scoped expected object error", () => {
		expect(() => geminiAdapter().parseChunk(JSON.stringify(true))).toThrow(
			/geminiAdapter\.parseChunk: expected a JSON object/,
		);
	});

	it("LSA-G67: assembler drops usage metadata after candidate finish", async () => {
		async function* payloads() {
			yield payload({
				candidates: [{ index: 0, content: { parts: [{ text: "x" }] } }],
			});
			yield payload({
				candidates: [{ index: 0, finishReason: "STOP", content: { parts: [] } }],
			});
			yield payload({
				usageMetadata: { promptTokenCount: 2, candidatesTokenCount: 1, totalTokenCount: 3 },
			});
		}
		const events = await collectAsync(assembleFromPayloads(payloads(), geminiAdapter()));
		expect(events.some((event) => event.type === "finish")).toBe(true);
		expect(events.some((event) => event.type === "usage")).toBe(false);
	});
});
