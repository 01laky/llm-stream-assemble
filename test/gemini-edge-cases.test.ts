import { describe, expect, it } from "vitest";
import { geminiAdapter } from "../src/adapters/gemini";
import { assembleFromPayloads } from "../src/core/assemble-payloads";
import { assembleStream } from "../src/core/assemble-stream";
import { byteStreamFromStrings, collectAsync, strings } from "./helpers/collect-events";
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

	it("LSA-G70: jsonMode maps text parts to json-delta", async () => {
		const events = await collectAsync(
			assembleFromPayloads(
				strings(
					payload({
						candidates: [{ index: 0, content: { parts: [{ text: '{"x":1}' }] } }],
					}),
					payload({
						candidates: [{ index: 0, finishReason: "STOP", content: { parts: [] } }],
					}),
				),
				geminiAdapter({ jsonMode: true }),
			),
		);
		expect(events.some((event) => event.type === "json.delta")).toBe(true);
		expect(events.some((event) => event.type === "text.delta")).toBe(false);
	});

	it("LSA-G71: thought part maps to reasoning-delta", () => {
		expect(
			geminiAdapter().parseChunk(
				payload({
					candidates: [{ index: 0, content: { parts: [{ text: "hidden", thought: true }] } }],
				}),
			),
		).toEqual([{ kind: "reasoning-delta", text: "hidden", variant: "detail" }]);
	});

	it("LSA-G72: assembler drops post-finish candidate text", async () => {
		async function* payloads() {
			yield payload({
				candidates: [{ index: 0, content: { parts: [{ text: "ok" }] } }],
			});
			yield payload({
				candidates: [{ index: 0, finishReason: "STOP", content: { parts: [] } }],
			});
			yield payload({
				candidates: [{ index: 0, content: { parts: [{ text: "late" }] } }],
			});
		}
		const events = await collectAsync(assembleFromPayloads(payloads(), geminiAdapter()));
		expect(events.filter((event) => event.type === "text.delta")).toHaveLength(1);
	});

	it("LSA-G73: malformed JSON throws geminiAdapter.parseChunk prefix", () => {
		expect(() => geminiAdapter().parseChunk("{")).toThrow(/geminiAdapter\.parseChunk/);
	});

	it("LSA-G74: empty candidates array yields no text chunks", () => {
		expect(geminiAdapter().parseChunk(payload({ candidates: [] }))).toEqual([]);
	});

	it("LSA-G75: promptFeedback blockReason emits provider error", () => {
		const chunks = geminiAdapter().parseChunk(
			payload({ promptFeedback: { blockReason: "SAFETY" } }),
		);
		expect(chunks[0]?.kind).toBe("provider-error");
		if (chunks[0]?.kind === "provider-error") {
			expect(chunks[0].error.message).toMatch(/SAFETY/);
		}
	});

	it("LSA-G76: finishReason MAX_TOKENS maps to finish length", () => {
		expect(
			geminiAdapter().parseChunk(
				payload({
					candidates: [{ index: 0, finishReason: "MAX_TOKENS", content: { parts: [] } }],
				}),
			),
		).toContainEqual({ kind: "finish", reason: "length", choiceIndex: 0 });
	});

	it("LSA-G77: finishReason SAFETY maps to finish content_filter", () => {
		expect(
			geminiAdapter().parseChunk(
				payload({
					candidates: [{ index: 0, finishReason: "SAFETY", content: { parts: [] } }],
				}),
			),
		).toContainEqual({ kind: "finish", reason: "content_filter", choiceIndex: 0 });
	});

	it("LSA-G78: functionCall partialArgs emit incremental tool-args-delta", () => {
		const adapter = geminiAdapter();
		expect(
			adapter.parseChunk(
				payload({
					candidates: [
						{
							index: 0,
							content: {
								parts: [
									{
										functionCall: {
											name: "search",
											partialArgs: [{ jsonPath: "$.q", stringValue: "hello" }],
											willContinue: true,
										},
									},
								],
							},
						},
					],
				}),
			),
		).toContainEqual({
			kind: "tool-args-delta",
			id: "gemini:0:0",
			delta: "hello",
			index: 0,
			choiceIndex: 0,
		});
	});

	it("LSA-G79: unicode text part preserved in parseChunk", () => {
		expect(
			geminiAdapter().parseChunk(
				payload({
					candidates: [{ index: 0, content: { parts: [{ text: "čaj 🍵" }] } }],
				}),
			),
		).toContainEqual({ kind: "text-delta", text: "čaj 🍵", choiceIndex: 0 });
	});

	it("LSA-G80: usage-only payload emits usage without text", () => {
		const chunks = geminiAdapter().parseChunk(
			payload({
				usageMetadata: { promptTokenCount: 4, candidatesTokenCount: 0, totalTokenCount: 4 },
			}),
		);
		expect(chunks.some((chunk) => chunk.kind === "usage")).toBe(true);
		expect(chunks.some((chunk) => chunk.kind === "text-delta")).toBe(false);
	});

	it("LSA-G81: duplicate responseId metadata suppressed after first chunk", () => {
		const adapter = geminiAdapter();
		expect(
			adapter
				.parseChunk(payload({ responseId: "r1", candidates: [] }))
				.some((chunk) => chunk.kind === "message-start"),
		).toBe(true);
		expect(
			adapter
				.parseChunk(payload({ responseId: "r2", candidates: [] }))
				.some((chunk) => chunk.kind === "message-start"),
		).toBe(false);
	});

	it("LSA-G82: functionCall args object emits tool-start and args-delta", () => {
		expect(
			geminiAdapter().parseChunk(
				payload({
					candidates: [
						{
							index: 0,
							content: {
								parts: [{ functionCall: { name: "ping", args: { ok: true } } }],
							},
						},
					],
				}),
			),
		).toContainEqual(expect.objectContaining({ kind: "tool-start", name: "ping", choiceIndex: 0 }));
	});

	it("LSA-G83: thinking golden stream matches expected events", async () => {
		const events = normalizeGeminiEvents(
			await collectAsync(
				assembleStream(
					byteStreamFromStrings(geminiTextFixture("thinking", "sse")),
					geminiAdapter(),
				),
			),
		);
		expect(events).toEqual(expectedGeminiEvents("thinking"));
	});

	it("LSA-G84: duplicate candidate finish is dropped by assembler", async () => {
		const events = await collectAsync(
			assembleFromPayloads(
				strings(
					payload({
						candidates: [{ index: 0, content: { parts: [{ text: "x" }] } }],
					}),
					payload({
						candidates: [{ index: 0, finishReason: "STOP", content: { parts: [] } }],
					}),
					payload({
						candidates: [{ index: 0, finishReason: "STOP", content: { parts: [] } }],
					}),
				),
				geminiAdapter(),
			),
		);
		expect(events.filter((event) => event.type === "finish")).toHaveLength(1);
	});

	it("LSA-G85: empty object with no candidates yields no chunks", () => {
		expect(geminiAdapter().parseChunk(payload({}))).toEqual([]);
	});
});
