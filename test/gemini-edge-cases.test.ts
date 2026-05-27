import { describe, expect, it } from "vitest";
import { geminiAdapter } from "../src/adapters/gemini";
import { assembleFromPayloads } from "../src/core/assemble-payloads";
import { assembleStream } from "../src/core/assemble-stream";
import { byteStreamFromStrings, collectAsync, strings } from "./helpers/collect-events";
import {
	assembleVertexJsonl,
	expectedGeminiEvents,
	expectedVertexEvents,
	geminiTextFixture,
	normalizeGeminiEvents,
} from "./helpers/gemini-fixtures";

const payload = (value: unknown) => JSON.stringify(value);

describe("geminiAdapter edge cases", () => {
	it("LSA-G59: citationMetadata and groundingMetadata emit citation and grounding chunks", () => {
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
				kind: "citation",
				raw: { citations: [{ uri: "urn:x" }] },
				sources: [{ uri: "urn:x" }],
			},
			{
				kind: "grounding",
				raw: { groundingChunks: [{ web: { uri: "https://example.com" } }] },
				chunks: [{ web: { uri: "https://example.com" } }],
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

	it("LSA-G86: empty or whitespace line yields no chunks", () => {
		expect(geminiAdapter().parseChunk("")).toEqual([]);
		expect(geminiAdapter().parseChunk("  ")).toEqual([]);
	});

	it("LSA-G87: [DONE] marker yields no chunks", () => {
		expect(geminiAdapter().parseChunk("[DONE]")).toEqual([]);
	});

	it("LSA-G88: non-object JSON throws scoped expected object error", () => {
		expect(() => geminiAdapter().parseChunk(JSON.stringify(true))).toThrow(
			/geminiAdapter\.parseChunk: expected a JSON object/,
		);
	});

	it("LSA-G89: assembler drops usage metadata after candidate finish", async () => {
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

	it("LSA-G90: jsonMode maps text parts to json-delta", async () => {
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

	it("LSA-G91: jsonMode assembler drops post-finish json text parts", async () => {
		async function* payloads() {
			yield payload({
				candidates: [{ index: 0, content: { parts: [{ text: '{"a":1}' }] } }],
			});
			yield payload({
				candidates: [{ index: 0, finishReason: "STOP", content: { parts: [] } }],
			});
			yield payload({
				candidates: [{ index: 0, content: { parts: [{ text: '{"late":true}' }] } }],
			});
		}
		const events = await collectAsync(
			assembleFromPayloads(payloads(), geminiAdapter({ jsonMode: true })),
		);
		expect(
			events.some((event) => event.type === "json.delta" && event.delta.includes("late")),
		).toBe(false);
	});

	it("LSA-G92: finishReason RECITATION maps to finish content_filter", () => {
		expect(
			geminiAdapter().parseChunk(
				payload({
					candidates: [{ index: 0, finishReason: "RECITATION", content: { parts: [] } }],
				}),
			),
		).toContainEqual({ kind: "finish", reason: "content_filter", choiceIndex: 0 });
	});

	it("LSA-G93: assembler drops post-finish functionCall partialArgs", async () => {
		async function* payloads() {
			yield payload({
				candidates: [
					{
						index: 0,
						content: {
							parts: [{ functionCall: { name: "fn", args: { id: "t1" } } }],
						},
					},
				],
			});
			yield payload({
				candidates: [{ index: 0, finishReason: "STOP", content: { parts: [] } }],
			});
			yield payload({
				candidates: [
					{
						index: 0,
						content: {
							parts: [{ functionCall: { name: "fn", partialArgs: [{ json: '{"late":' }] } }],
						},
					},
				],
			});
		}
		const events = await collectAsync(assembleFromPayloads(payloads(), geminiAdapter()));
		expect(
			events.some((event) => event.type === "tool_call.args.delta" && event.delta.includes("late")),
		).toBe(false);
	});

	it("LSA-G94: json-mode golden stream matches expected events", async () => {
		const events = normalizeGeminiEvents(
			await collectAsync(
				assembleStream(
					byteStreamFromStrings(geminiTextFixture("json-mode", "sse")),
					geminiAdapter({ jsonMode: true }),
				),
			),
		);
		expect(events).toEqual(expectedGeminiEvents("json-mode"));
	});

	it("LSA-G95: provider-error golden stream matches expected events", async () => {
		const events = normalizeGeminiEvents(
			await collectAsync(
				assembleStream(
					byteStreamFromStrings(geminiTextFixture("provider-error", "sse")),
					geminiAdapter(),
				),
			),
		);
		expect(events).toEqual(expectedGeminiEvents("provider-error"));
	});

	it("LSA-G96: finishReason BLOCKLIST maps to finish content_filter", () => {
		expect(
			geminiAdapter().parseChunk(
				payload({
					candidates: [{ index: 0, finishReason: "BLOCKLIST", content: { parts: [] } }],
				}),
			),
		).toContainEqual({ kind: "finish", reason: "content_filter", choiceIndex: 0 });
	});

	it("LSA-G97: tool-single golden stream matches expected events", async () => {
		const events = normalizeGeminiEvents(
			await collectAsync(
				assembleStream(
					byteStreamFromStrings(geminiTextFixture("tool-single", "sse")),
					geminiAdapter(),
				),
			),
		);
		expect(events).toEqual(expectedGeminiEvents("tool-single"));
	});

	it("LSA-G98: text-basic golden stream matches expected events", async () => {
		const events = normalizeGeminiEvents(
			await collectAsync(
				assembleStream(
					byteStreamFromStrings(geminiTextFixture("text-basic", "sse")),
					geminiAdapter(),
				),
			),
		);
		expect(events).toEqual(expectedGeminiEvents("text-basic"));
	});

	it("LSA-G100: citation-only candidate", () => {
		const chunks = geminiAdapter().parseChunk(
			payload({
				candidates: [
					{
						index: 0,
						citationMetadata: { citations: [{ uri: "urn:only" }] },
						content: { parts: [] },
					},
				],
			}),
		);
		expect(chunks).toEqual([
			{
				kind: "citation",
				raw: { citations: [{ uri: "urn:only" }] },
				sources: [{ uri: "urn:only" }],
			},
		]);
	});

	it("LSA-G101: grounding-only candidate", () => {
		const chunks = geminiAdapter().parseChunk(
			payload({
				candidates: [
					{
						index: 0,
						groundingMetadata: { webSearchQueries: ["only-query"] },
						content: { parts: [] },
					},
				],
			}),
		);
		expect(chunks).toEqual([
			{ kind: "grounding", raw: { webSearchQueries: ["only-query"] }, queries: ["only-query"] },
		]);
	});

	it("LSA-G102: both metadata types on one candidate", () => {
		const kinds = geminiAdapter()
			.parseChunk(
				payload({
					candidates: [
						{
							index: 0,
							citationMetadata: { citations: [{ uri: "urn:x" }] },
							groundingMetadata: { groundingChunks: [{ web: { uri: "https://a.test" } }] },
							content: { parts: [{ text: "x" }] },
						},
					],
				}),
			)
			.map((chunk) => chunk.kind);
		expect(kinds).toEqual(["citation", "grounding", "text-delta"]);
	});

	it("LSA-G103: raw fields preserved on each event", async () => {
		const events = await collectAsync(
			assembleFromPayloads(
				(async function* () {
					yield payload({
						candidates: [
							{
								index: 0,
								citationMetadata: { citations: [{ uri: "urn:raw" }] },
								groundingMetadata: { webSearchQueries: ["q"] },
								content: { parts: [{ text: "t" }] },
							},
						],
					});
				})(),
				geminiAdapter(),
			),
		);
		const citation = events.find((event) => event.type === "citation");
		const grounding = events.find((event) => event.type === "grounding");
		expect(citation).toMatchObject({ raw: { citations: [{ uri: "urn:raw" }] } });
		expect(grounding).toMatchObject({ raw: { webSearchQueries: ["q"] } });
	});

	it("LSA-G104: post-finish grounding dropped", async () => {
		async function* payloads() {
			yield payload({
				candidates: [{ index: 0, finishReason: "STOP", content: { parts: [] } }],
			});
			yield payload({
				candidates: [
					{
						index: 0,
						groundingMetadata: { webSearchQueries: ["late"] },
						content: { parts: [] },
					},
				],
			});
		}
		const events = await collectAsync(assembleFromPayloads(payloads(), geminiAdapter()));
		expect(events.some((event) => event.type === "grounding")).toBe(false);
	});

	it("LSA-G105: google-ai text-basic unchanged (no false citation)", async () => {
		const events = normalizeGeminiEvents(
			await collectAsync(
				assembleStream(
					byteStreamFromStrings(geminiTextFixture("text-basic", "sse")),
					geminiAdapter(),
				),
			),
		);
		expect(events.some((event) => (event as { type?: string }).type === "citation")).toBe(false);
		expect(events).toEqual(expectedGeminiEvents("text-basic"));
	});

	it("LSA-G106: grounding webSearchQueries maps to queries", () => {
		const chunks = geminiAdapter().parseChunk(
			payload({
				candidates: [
					{
						index: 0,
						groundingMetadata: { webSearchQueries: ["weather"] },
						content: { parts: [] },
					},
				],
			}),
		);
		expect(chunks).toContainEqual(
			expect.objectContaining({ kind: "grounding", queries: ["weather"] }),
		);
	});

	it("LSA-G107: groundingChunks maps to chunks", () => {
		const chunkList = [{ web: { uri: "https://chunks.test" } }];
		const chunks = geminiAdapter().parseChunk(
			payload({
				candidates: [
					{
						index: 0,
						groundingMetadata: { groundingChunks: chunkList },
						content: { parts: [] },
					},
				],
			}),
		);
		expect(chunks).toContainEqual(
			expect.objectContaining({ kind: "grounding", chunks: chunkList }),
		);
	});

	it("LSA-G108: citationMetadata sources mapping", () => {
		const sources = [{ uri: "https://source.test", title: "Doc" }];
		const chunks = geminiAdapter().parseChunk(
			payload({
				candidates: [
					{
						index: 0,
						citationMetadata: { citations: sources },
						content: { parts: [] },
					},
				],
			}),
		);
		expect(chunks).toContainEqual(expect.objectContaining({ kind: "citation", sources }));
	});

	it("LSA-G109: Google AI grounding-metadata.sse golden", async () => {
		const events = normalizeGeminiEvents(
			await collectAsync(
				assembleStream(
					byteStreamFromStrings(geminiTextFixture("grounding-metadata", "sse")),
					geminiAdapter(),
				),
			),
		);
		expect(events).toEqual(expectedGeminiEvents("grounding-metadata"));
	});

	it("LSA-G110: Google AI vs Vertex grounding-metadata normalized field parity", async () => {
		const google = normalizeGeminiEvents(
			await collectAsync(
				assembleStream(
					byteStreamFromStrings(geminiTextFixture("grounding-metadata", "sse")),
					geminiAdapter(),
				),
			),
		);
		const vertex = normalizeGeminiEvents(
			await assembleVertexJsonl("grounding-metadata", { apiSurface: "vertex" }),
		);
		const googleTypes = google.map((event) => (event as { type?: string }).type);
		const vertexTypes = vertex.map((event) => (event as { type?: string }).type);
		expect(googleTypes.filter((type) => type === "citation" || type === "grounding")).toEqual(
			vertexTypes.filter((type) => type === "citation" || type === "grounding"),
		);
	});

	it("LSA-G111: groundingSupports maps to grounding.supports on Google AI", () => {
		const chunks = geminiAdapter().parseChunk(
			payload({
				candidates: [
					{
						index: 0,
						groundingMetadata: {
							groundingSupports: [{ segment: { startIndex: 0, endIndex: 5, text: "hello" } }],
						},
						content: { parts: [] },
					},
				],
			}),
		);
		expect(chunks).toContainEqual(
			expect.objectContaining({
				kind: "grounding",
				supports: [{ segment: { startIndex: 0, endIndex: 5, text: "hello" } }],
			}),
		);
	});

	it("LSA-G112: post-finish citationMetadata dropped on Google AI stream", async () => {
		async function* payloads() {
			yield payload({
				candidates: [{ index: 0, finishReason: "STOP", content: { parts: [] } }],
			});
			yield payload({
				candidates: [
					{
						index: 0,
						citationMetadata: { citations: [{ uri: "urn:late-g112" }] },
						content: { parts: [] },
					},
				],
			});
		}
		const events = await collectAsync(assembleFromPayloads(payloads(), geminiAdapter()));
		expect(events.some((event) => event.type === "citation")).toBe(false);
	});

	it("LSA-G113: emitLegacyCitationMetadata on geminiAdapter dual-emits metadata raw", () => {
		const chunks = geminiAdapter({ emitLegacyCitationMetadata: true }).parseChunk(
			payload({
				candidates: [
					{
						index: 0,
						citationMetadata: { citations: [{ uri: "urn:g113" }] },
						content: { parts: [] },
					},
				],
			}),
		);
		expect(chunks.some((chunk) => chunk.kind === "citation")).toBe(true);
		expect(chunks.some((chunk) => chunk.kind === "metadata")).toBe(true);
	});

	it("LSA-G114: grounding-chunks vertex jsonl golden matches expected", async () => {
		expect(normalizeGeminiEvents(await assembleVertexJsonl("grounding-chunks"))).toEqual(
			expectedVertexEvents("grounding-chunks"),
		);
	});

	it("LSA-G115: empty citationMetadata citations array still emits citation with raw", () => {
		const chunks = geminiAdapter().parseChunk(
			payload({
				candidates: [
					{
						index: 0,
						citationMetadata: { citations: [] },
						content: { parts: [{ text: "x" }] },
					},
				],
			}),
		);
		expect(chunks).toContainEqual(
			expect.objectContaining({ kind: "citation", raw: { citations: [] }, sources: [] }),
		);
	});
});
