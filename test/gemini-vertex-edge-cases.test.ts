import { describe, expect, it } from "vitest";
import { geminiAdapter, normalizeVertexChunk } from "../src/adapters/gemini";
import { assembleFromPayloads } from "../src/core/assemble-payloads";
import { collectAsync } from "./helpers/collect-events";
import {
	assembleVertexJsonl,
	expectedVertexEvents,
	normalizeGeminiEvents,
	vertexJsonlLines,
} from "./helpers/gemini-fixtures";

const vertex = () => geminiAdapter({ apiSurface: "vertex" });
const payload = (value: unknown) => JSON.stringify(value);

describe("geminiAdapter vertex edge golden streams", () => {
	const fixtures = [
		["prompt-blocked", "LSA-GV78"],
		["provider-error", "LSA-GV79"],
		["empty-candidates", "LSA-GV80"],
		["incomplete", "LSA-GV81"],
		["unknown-envelope", "LSA-GV82"],
		["text-unicode", "LSA-GV83"],
		["text-empty-parts", "LSA-GV84"],
		["thinking", "LSA-GV85"],
	] as const;

	it.each(fixtures)("%s matches expected events (%s)", async (name) => {
		expect(normalizeGeminiEvents(await assembleVertexJsonl(name))).toEqual(
			expectedVertexEvents(name),
		);
	});
});

describe("geminiAdapter vertex envelope and grounding edge cases", () => {
	it("LSA-GV86: envelope-tuned-endpoint matches expected events", async () => {
		expect(normalizeGeminiEvents(await assembleVertexJsonl("envelope-tuned-endpoint"))).toEqual(
			expectedVertexEvents("envelope-tuned-endpoint"),
		);
	});

	it("LSA-GV87: envelope-wrapped inner equals text-basic mapping", async () => {
		const wrapped = normalizeGeminiEvents(await assembleVertexJsonl("envelope-wrapped"));
		const basic = normalizeGeminiEvents(await assembleVertexJsonl("text-basic"));
		expect(wrapped).toEqual(basic);
	});

	it("LSA-GV88: grounding-metadata golden includes metadata before text", async () => {
		expect(normalizeGeminiEvents(await assembleVertexJsonl("grounding-metadata"))).toEqual(
			expectedVertexEvents("grounding-metadata"),
		);
	});

	it("LSA-GV89: grounding-chunks golden matches expected events", async () => {
		expect(normalizeGeminiEvents(await assembleVertexJsonl("grounding-chunks"))).toEqual(
			expectedVertexEvents("grounding-chunks"),
		);
	});

	it("LSA-GV90: json-mode vertex stream matches golden", async () => {
		expect(
			normalizeGeminiEvents(await assembleVertexJsonl("json-mode", { jsonMode: true })),
		).toEqual(expectedVertexEvents("json-mode"));
	});
});

describe("geminiAdapter vertex parseChunk edge cases", () => {
	it("LSA-GV91: empty object returns [] on vertex surface", () => {
		expect(vertex().parseChunk("{}")).toEqual([]);
	});

	it("LSA-GV92: unknown envelope forwards metadata.raw", () => {
		const chunks = vertex().parseChunk(payload({ vertexTraceId: "trace-91", status: "OK" }));
		expect(chunks).toEqual([
			{ kind: "metadata", raw: { vertexTraceId: "trace-91", status: "OK" } },
		]);
	});

	it("LSA-GV93: unicode text in wrapped response", () => {
		const chunks = vertex().parseChunk(
			payload({
				response: {
					candidates: [{ index: 0, content: { parts: [{ text: "čaj 🍵" }] } }],
				},
			}),
		);
		expect(chunks).toContainEqual({ kind: "text-delta", text: "čaj 🍵", choiceIndex: 0 });
	});

	it("LSA-GV94: empty parts array yields no text deltas", () => {
		const chunks = vertex().parseChunk(
			payload({
				responseId: "p94",
				candidates: [{ index: 0, content: { parts: [] } }],
			}),
		);
		expect(chunks.some((c) => c.kind === "text-delta")).toBe(false);
	});

	it("LSA-GV95: normalizeVertexChunk returns null for trace-only envelope", () => {
		expect(normalizeVertexChunk({ vertexTraceId: "only-trace" })).toBeNull();
	});
});

describe("geminiAdapter vertex extended edge cases", () => {
	it("LSA-GV105: citationMetadata and groundingMetadata emit metadata raw via response wrapper", () => {
		expect(
			vertex().parseChunk(
				payload({
					response: {
						candidates: [
							{
								index: 0,
								citationMetadata: { citations: [{ uri: "urn:x" }] },
								groundingMetadata: {
									groundingChunks: [{ web: { uri: "https://example.com" } }],
								},
								content: { parts: [] },
							},
						],
					},
				}),
			),
		).toContainEqual({
			kind: "metadata",
			raw: {
				citationMetadata: { citations: [{ uri: "urn:x" }] },
				groundingMetadata: {
					groundingChunks: [{ web: { uri: "https://example.com" } }],
				},
			},
		});
	});

	it("LSA-GV106: executableCode parts are skipped on vertex surface", () => {
		expect(
			vertex().parseChunk(
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
	});

	it("LSA-GV107: codeExecutionResult parts are skipped on vertex surface", () => {
		expect(
			vertex().parseChunk(
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

	it("LSA-GV108: MALFORMED_FUNCTION_CALL emits provider error plus finish error", () => {
		const chunks = vertex().parseChunk(
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
		expect(chunks[0]?.kind).toBe("provider-error");
		expect(chunks[1]).toEqual({ kind: "finish", reason: "error" });
	});

	it("LSA-GV109: non-zero candidate index forwarded on text deltas", () => {
		expect(
			vertex().parseChunk(
				payload({
					candidates: [{ index: 2, content: { parts: [{ text: "branch" }] } }],
				}),
			),
		).toEqual([{ kind: "text-delta", text: "branch", choiceIndex: 2 }]);
	});

	it("LSA-GV110: non-object JSON throws scoped expected object error", () => {
		expect(() => vertex().parseChunk(JSON.stringify(true))).toThrow(
			/geminiAdapter\.parseChunk: expected a JSON object/,
		);
	});

	it("LSA-GV111: assembler drops usage metadata after candidate finish", async () => {
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
		const events = await collectAsync(assembleFromPayloads(payloads(), vertex()));
		expect(events.some((event) => event.type === "finish")).toBe(true);
		expect(events.some((event) => event.type === "usage")).toBe(false);
	});

	it("LSA-GV112: google-ai surface does not unwrap response wrapper", () => {
		const wrapped = payload({
			response: {
				candidates: [{ index: 0, content: { parts: [{ text: "inner" }] } }],
			},
		});
		expect(
			geminiAdapter()
				.parseChunk(wrapped)
				.some((c) => c.kind === "text-delta"),
		).toBe(false);
		expect(
			vertex()
				.parseChunk(wrapped)
				.some((c) => c.kind === "text-delta"),
		).toBe(true);
	});

	it("LSA-GV113: empty predictions array yields null from normalizeVertexChunk", () => {
		expect(normalizeVertexChunk({ predictions: [] })).toBeNull();
	});

	it("LSA-GV114: predictions with non-object first entry yields null", () => {
		expect(normalizeVertexChunk({ predictions: ["not-an-object"] })).toBeNull();
	});

	it("LSA-GV115: duplicate message-start ignored after first responseId chunk", () => {
		const adapter = vertex();
		adapter.parseChunk(payload({ responseId: "dup", candidates: [] }));
		const second = adapter.parseChunk(payload({ responseId: "dup2", candidates: [] }));
		expect(second.filter((c) => c.kind === "message-start")).toEqual([]);
	});

	it("LSA-GV116: parallel tools keep distinct ids through vertex assembly", async () => {
		const events = normalizeGeminiEvents(await assembleVertexJsonl("tool-parallel"));
		const starts = events.filter((event) => event.type === "tool_call.start");
		expect(starts.map((event) => event.id)).toEqual(["call_a", "call_b"]);
	});

	it("LSA-GV117: jsonMode maps text deltas to json events on vertex assembly", async () => {
		const events = await assembleVertexJsonl("json-mode", { jsonMode: true });
		expect(events.some((event) => event.type === "json.delta")).toBe(true);
		expect(events.some((event) => event.type === "text.delta")).toBe(false);
	});

	it("LSA-GV118: provider error in response wrapper unwraps and maps", () => {
		const chunks = vertex().parseChunk(
			payload({
				response: { error: { message: "denied", code: 403 } },
			}),
		);
		expect(chunks.some((c) => c.kind === "provider-error")).toBe(true);
	});

	it("LSA-GV119: blockReason in wrapped response maps provider error", () => {
		const chunks = vertex().parseChunk(
			payload({
				response: { promptFeedback: { blockReason: "SAFETY" } },
			}),
		);
		expect(chunks.some((c) => c.kind === "provider-error")).toBe(true);
	});

	it("LSA-GV120: groundingMetadata on candidate includes webSearchQueries in metadata raw", () => {
		const chunks = vertex().parseChunk(
			payload({
				candidates: [
					{
						index: 0,
						groundingMetadata: { webSearchQueries: ["weather Boston"] },
						content: { parts: [{ text: "ok" }] },
					},
				],
			}),
		);
		expect(chunks).toContainEqual({
			kind: "metadata",
			raw: { groundingMetadata: { webSearchQueries: ["weather Boston"] } },
		});
	});

	it("LSA-GV121: assembler drops post-finish text delta on vertex surface", async () => {
		async function* payloads() {
			yield payload({
				responseId: "late-text",
				candidates: [{ index: 0, content: { parts: [{ text: "before" }] } }],
			});
			yield payload({
				candidates: [{ index: 0, finishReason: "STOP", content: { parts: [] } }],
			});
			yield payload({
				candidates: [{ index: 0, content: { parts: [{ text: "late" }] } }],
			});
		}
		const events = await collectAsync(assembleFromPayloads(payloads(), vertex()));
		expect(events.filter((event) => event.type === "text.delta")).toHaveLength(1);
		if (events[0]?.type === "text.delta") {
			expect(events[0].text).toBe("before");
		}
	});

	it("LSA-GV122: assembler drops post-finish usage on trailing chunk", async () => {
		async function* payloads() {
			yield payload({
				responseId: "late-usage",
				candidates: [{ index: 0, content: { parts: [{ text: "x" }] } }],
			});
			yield payload({
				candidates: [{ index: 0, finishReason: "STOP", content: { parts: [] } }],
			});
			yield payload({
				usageMetadata: { promptTokenCount: 9, candidatesTokenCount: 1 },
			});
		}
		const events = await collectAsync(assembleFromPayloads(payloads(), vertex()));
		expect(events.some((event) => event.type === "finish")).toBe(true);
		expect(events.some((event) => event.type === "usage")).toBe(false);
	});

	it("LSA-GV123: tool follow-up chunk reconciles by explicit id on vertex surface", () => {
		const adapter = vertex();
		adapter.parseChunk(
			payload({
				candidates: [
					{
						index: 0,
						content: { parts: [{ functionCall: { name: "lookup", id: "call_nba" } }] },
					},
				],
			}),
		);
		expect(
			adapter.parseChunk(
				payload({
					candidates: [
						{
							index: 0,
							content: { parts: [{ functionCall: { id: "call_nba", args: { id: 42 } } }] },
						},
					],
				}),
			),
		).toEqual([
			{
				kind: "tool-args-delta",
				id: "call_nba",
				delta: '{"id":42}',
				index: 0,
				choiceIndex: 0,
			},
			{ kind: "tool-done", id: "call_nba", index: 0, choiceIndex: 0 },
		]);
	});

	it("LSA-GV124: synthesized gemini id when tool omits explicit id", () => {
		expect(
			vertex().parseChunk(
				payload({
					candidates: [
						{
							index: 0,
							content: { parts: [{ functionCall: { name: "solo" } }] },
						},
					],
				}),
			),
		).toContainEqual({
			kind: "tool-start",
			id: "gemini:0:0",
			name: "solo",
			index: 0,
			choiceIndex: 0,
		});
	});

	it("LSA-GV125: willContinue without closing emits tool-start and args but no tool-done", () => {
		expect(
			vertex().parseChunk(
				payload({
					candidates: [
						{
							index: 0,
							content: {
								parts: [
									{
										functionCall: {
											name: "save",
											id: "call_f",
											args: { ok: true },
											willContinue: true,
										},
									},
								],
							},
						},
					],
				}),
			),
		).toEqual([
			{ kind: "tool-start", id: "call_f", name: "save", index: 0, choiceIndex: 0 },
			{
				kind: "tool-args-delta",
				id: "call_f",
				delta: '{"ok":true}',
				index: 0,
				choiceIndex: 0,
			},
		]);
	});

	it("LSA-GV126: unknown-envelope stream golden matches expected forward-compat metadata", async () => {
		expect(normalizeGeminiEvents(await assembleVertexJsonl("unknown-envelope"))).toEqual(
			expectedVertexEvents("unknown-envelope"),
		);
	});

	it("LSA-GV127: each text-basic jsonl line parses without throw on vertex surface", () => {
		for (const line of vertexJsonlLines("text-basic")) {
			expect(() => vertex().parseChunk(line)).not.toThrow();
		}
	});

	it("LSA-GV128: result wrapper unwraps nested usage on parseChunk", () => {
		const chunks = vertex().parseChunk(
			payload({
				result: {
					usageMetadata: { promptTokenCount: 4, candidatesTokenCount: 6 },
				},
			}),
		);
		expect(chunks).toContainEqual({
			kind: "usage",
			inputTokens: 4,
			outputTokens: 6,
			raw: { promptTokenCount: 4, candidatesTokenCount: 6 },
		});
	});
});
