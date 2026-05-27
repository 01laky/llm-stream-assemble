import { describe, expect, it } from "vitest";
import { cohereAdapter } from "../src/adapters/cohere";
import { geminiAdapter } from "../src/adapters/gemini";
import { openaiCompatibleAdapter } from "../src/adapters/openai-compatible";
import { createAssemblyTransform } from "../src/core/create-assembly-transform";
import { EventAssembler } from "../src/core/assembler/event-assembler";
import { assembleFromPayloads } from "../src/core/assemble-payloads";
import { assembleResponse } from "../src/core/assemble-response";
import { matchEvent } from "../src/helpers/match-event";
import { collectStream } from "../src/transforms/collect-stream";
import { tapEvents } from "../src/transforms/tap-events";
import { toSSE } from "../src/transforms/to-sse";
import { collectAsync } from "./helpers/collect-events";
import {
	assembleCohereResponse,
	cohereJSONFixture,
	expectedCohereEvents,
} from "./helpers/cohere-fixtures";
import {
	assembleVertexJsonl,
	expectedVertexEvents,
	normalizeGeminiEvents,
} from "./helpers/gemini-fixtures";

const payload = (value: unknown) => JSON.stringify(value);

async function readSseJsonLines(stream: ReadableStream<Uint8Array>): Promise<unknown[]> {
	const reader = stream.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	const lines: unknown[] = [];
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });
		const parts = buffer.split("\n\n");
		buffer = parts.pop() ?? "";
		for (const part of parts) {
			const line = part.trim();
			if (!line.startsWith("data: ")) continue;
			lines.push(JSON.parse(line.slice(6)) as unknown);
		}
	}
	return lines;
}

describe("citation and grounding extended edge cases", () => {
	it("LSA-CT30: Gemini groundingSupports maps to grounding.supports", () => {
		const chunks = geminiAdapter().parseChunk(
			payload({
				candidates: [
					{
						index: 0,
						groundingMetadata: {
							groundingSupports: [{ segment: { startIndex: 0, endIndex: 4, text: "hi" } }],
						},
						content: { parts: [] },
					},
				],
			}),
		);
		expect(chunks).toContainEqual(
			expect.objectContaining({
				kind: "grounding",
				supports: [{ segment: { startIndex: 0, endIndex: 4, text: "hi" } }],
			}),
		);
	});

	it("LSA-CT31: Gemini emitLegacyCitationMetadata dual-emits typed and metadata raw", () => {
		const chunks = geminiAdapter({ emitLegacyCitationMetadata: true }).parseChunk(
			payload({
				candidates: [
					{
						index: 0,
						citationMetadata: { citations: [{ uri: "urn:legacy" }] },
						groundingMetadata: { webSearchQueries: ["q"] },
						content: { parts: [] },
					},
				],
			}),
		);
		expect(chunks.some((chunk) => chunk.kind === "citation")).toBe(true);
		expect(chunks.some((chunk) => chunk.kind === "grounding")).toBe(true);
		expect(
			chunks.some(
				(chunk) =>
					chunk.kind === "metadata" &&
					"citationMetadata" in ((chunk as { raw?: Record<string, unknown> }).raw ?? {}),
			),
		).toBe(true);
	});

	it("LSA-CT32: Cohere emitLegacyCitationMetadata dual-emits citation and metadata raw", () => {
		const chunks = cohereAdapter({ emitLegacyCitationMetadata: true }).parseChunk(
			payload({
				type: "citation-start",
				index: 0,
				delta: { message: { citations: { start: 0, end: 1, text: "a" } } },
			}),
		);
		expect(chunks).toContainEqual(expect.objectContaining({ kind: "citation" }));
		expect(chunks).toContainEqual(
			expect.objectContaining({
				kind: "metadata",
				raw: { citation: { start: 0, end: 1, text: "a" }, index: 0 },
			}),
		);
	});

	it("LSA-CT33: Perplexity search_results only emits citation with searchResults", () => {
		const chunks = openaiCompatibleAdapter({ provider: "perplexity" }).parseChunk(
			payload({
				search_results: [{ url: "https://only-search.test", title: "Doc" }],
				choices: [{ delta: {} }],
			}),
		);
		expect(chunks).toEqual([
			expect.objectContaining({
				kind: "citation",
				searchResults: [{ url: "https://only-search.test", title: "Doc" }],
			}),
		]);
		expect(chunks.some((chunk) => "urls" in chunk && (chunk as { urls?: string[] }).urls)).toBe(
			false,
		);
	});

	it("LSA-CT34: Perplexity urls omit non-string citation entries", () => {
		const chunks = openaiCompatibleAdapter({ provider: "perplexity" }).parseChunk(
			payload({
				citations: ["https://valid.test", { url: "skip" }, 42, null],
				choices: [{ delta: {} }],
			}),
		);
		const citation = chunks.find((chunk) => chunk.kind === "citation") as {
			urls?: string[];
			raw?: { citations?: unknown[] };
		};
		expect(citation?.urls).toEqual(["https://valid.test"]);
		expect(citation?.raw?.citations).toHaveLength(4);
	});

	it("LSA-CT35: post-finish Gemini citation dropped after STOP", async () => {
		async function* payloads() {
			yield payload({
				candidates: [{ index: 0, finishReason: "STOP", content: { parts: [] } }],
			});
			yield payload({
				candidates: [
					{
						index: 0,
						citationMetadata: { citations: [{ uri: "urn:late" }] },
						content: { parts: [] },
					},
				],
			});
		}
		const events = await collectAsync(assembleFromPayloads(payloads(), geminiAdapter()));
		expect(events.some((event) => event.type === "citation")).toBe(false);
	});

	it("LSA-CT36: Vertex grounding-chunks golden matches expected grounding event", async () => {
		expect(normalizeGeminiEvents(await assembleVertexJsonl("grounding-chunks"))).toEqual(
			expectedVertexEvents("grounding-chunks"),
		);
	});

	it("LSA-CT37: Cohere response-citations assembleResponse matches golden", () => {
		expect(assembleCohereResponse("response-citations")).toEqual(
			expectedCohereEvents("response-citations"),
		);
	});

	it("LSA-CT38: tapEvents forwards citation and grounding events unchanged", async () => {
		const citation = { type: "citation" as const, urls: ["https://tap.test"] };
		const grounding = { type: "grounding" as const, queries: ["tap-query"] };
		async function* source() {
			yield citation;
			yield grounding;
		}
		const seen: string[] = [];
		const events = await collectAsync(
			tapEvents(source(), (event) => {
				seen.push(event.type);
			}),
		);
		expect(events).toEqual([citation, grounding]);
		expect(seen).toEqual(["citation", "grounding"]);
	});

	it("LSA-CT39: collectStream preserves citation and grounding order with text", async () => {
		const items = [
			{ type: "text.delta" as const, text: "See " },
			{ type: "citation" as const, urls: ["https://order.test"] },
			{ type: "grounding" as const, queries: ["q"] },
			{ type: "text.delta" as const, text: " docs." },
			{ type: "text.done" as const, text: "See  docs." },
		];
		const result = await collectStream(
			(async function* () {
				for (const item of items) yield item;
			})(),
		);
		expect(result.text).toBe("See  docs.");
		expect(result.citations).toHaveLength(1);
		expect(result.grounding).toHaveLength(1);
		expect(result.citations[0]?.type).toBe("citation");
		expect(result.grounding[0]?.type).toBe("grounding");
	});

	it("LSA-CT40: Cohere citation with text-only span uses zero-based fallback offsets", () => {
		const chunks = cohereAdapter().parseChunk(
			payload({
				type: "citation-start",
				index: 0,
				delta: { message: { citations: { text: "only-label" } } },
			}),
		);
		expect(chunks).toContainEqual(
			expect.objectContaining({
				kind: "citation",
				span: { start: 0, end: 10, text: "only-label" },
			}),
		);
	});

	it("LSA-CT41: Cohere citation-start without citations field yields no citation chunk", () => {
		expect(
			cohereAdapter().parseChunk(
				payload({ type: "citation-start", index: 0, delta: { message: {} } }),
			),
		).toEqual([]);
	});

	it("LSA-CT42: Gemini multiple candidates each emit citation and grounding independently", () => {
		const chunks = geminiAdapter().parseChunk(
			payload({
				candidates: [
					{
						index: 0,
						citationMetadata: { citations: [{ uri: "urn:a" }] },
						content: { parts: [{ text: "a" }] },
					},
					{
						index: 1,
						groundingMetadata: { webSearchQueries: ["b-query"] },
						content: { parts: [{ text: "b" }] },
					},
				],
			}),
		);
		expect(chunks.filter((chunk) => chunk.kind === "citation")).toHaveLength(1);
		expect(chunks.filter((chunk) => chunk.kind === "grounding")).toHaveLength(1);
		expect(chunks.filter((chunk) => chunk.kind === "text-delta")).toHaveLength(2);
	});

	it("LSA-CT43: toSSE round-trip preserves citation text and finish ordering", async () => {
		const parsed = await readSseJsonLines(
			toSSE(
				(async function* () {
					yield { type: "citation" as const, urls: ["https://roundtrip.test"] };
					yield { type: "text.delta" as const, text: "answer" };
					yield { type: "finish" as const, reason: "stop" as const };
				})(),
			),
		);
		expect(parsed.map((event) => (event as { type?: string }).type)).toEqual([
			"citation",
			"text.delta",
			"finish",
		]);
	});

	it("LSA-CT44: matchEvent partial handlers still dispatch grounding when registered", () => {
		const events = [
			{ type: "grounding" as const, queries: ["weather"] },
			{ type: "text.delta" as const, text: "x" },
		];
		const results = events.map((event) =>
			matchEvent(event, {
				grounding: (e) => e.queries?.join(","),
				"text.delta": (e) => e.text,
			}),
		);
		expect(results).toEqual(["weather", "x"]);
	});

	it("LSA-CT45: Perplexity stream assembly omits duplicate citations from metadata.raw", async () => {
		async function* payloads() {
			yield payload({
				citations: ["https://no-dup.test"],
				choices: [{ delta: { content: "x" } }],
			});
		}
		const events = await collectAsync(
			assembleFromPayloads(payloads(), openaiCompatibleAdapter({ provider: "perplexity" })),
		);
		expect(events.some((event) => event.type === "citation")).toBe(true);
		expect(
			events.some(
				(event) =>
					event.type === "metadata" &&
					typeof event.raw === "object" &&
					event.raw !== null &&
					"citations" in (event.raw as Record<string, unknown>),
			),
		).toBe(false);
	});

	it("LSA-CT46: generic preset tolerates search_results only without throw", () => {
		expect(
			openaiCompatibleAdapter({ provider: "generic" }).parseChunk(
				payload({
					search_results: [{ url: "https://generic.test" }],
					choices: [{ delta: { content: "ok" } }],
				}),
			),
		).toContainEqual(
			expect.objectContaining({
				kind: "citation",
				searchResults: [{ url: "https://generic.test" }],
			}),
		);
	});

	it("LSA-CT47: grounding chunk with supports-only metadata still emits grounding event", () => {
		const [event] = new EventAssembler().push({
			kind: "grounding",
			supports: [{ segment: { startIndex: 0, endIndex: 3, text: "abc" } }],
			raw: { groundingSupports: [{ segment: { startIndex: 0, endIndex: 3, text: "abc" } }] },
		});
		expect(event).toMatchObject({
			type: "grounding",
			supports: [{ segment: { startIndex: 0, endIndex: 3, text: "abc" } }],
		});
	});

	it("LSA-CT48: assembler preserves citation raw provider payload on StreamEvent", () => {
		const raw = { citations: ["https://raw.test"], search_results: [{ url: "https://raw.test" }] };
		const [event] = new EventAssembler().push({
			kind: "citation",
			urls: ["https://raw.test"],
			raw,
		});
		expect(event).toMatchObject({ type: "citation", raw, urls: ["https://raw.test"] });
	});

	it("LSA-CT49: strictToolArgs with Perplexity citation stream still emits citation", async () => {
		async function* payloads() {
			yield payload({
				citations: ["https://strict.test"],
				choices: [{ delta: { content: "ok" } }],
			});
		}
		const events = await collectAsync(
			assembleFromPayloads(payloads(), openaiCompatibleAdapter({ provider: "perplexity" }), {
				strictToolArgs: true,
			}),
		);
		expect(events.some((event) => event.type === "citation")).toBe(true);
	});

	it("LSA-CT50: createAssemblyTransform gemini grounding events pass through pipeline", async () => {
		const transform = createAssemblyTransform(geminiAdapter());
		const collected = collectAsync(transform.readable);
		const writer = transform.writable.getWriter();
		await writer.write(
			new TextEncoder().encode(
				`data: ${JSON.stringify({
					candidates: [
						{
							index: 0,
							groundingMetadata: { webSearchQueries: ["transform-query"] },
							content: { parts: [{ text: "grounded" }] },
						},
					],
				})}\n\n`,
			),
		);
		await writer.write(new TextEncoder().encode("data: [DONE]\n\n"));
		await writer.close();
		const events = await collected;
		expect(events.some((event) => event.type === "grounding")).toBe(true);
		expect(events.some((event) => event.type === "text.delta")).toBe(true);
	});

	it("LSA-CT51: Cohere parseResponse on response-citations emits citation RawChunks", () => {
		const chunks = cohereAdapter().parseResponse!(cohereJSONFixture("response-citations"));
		expect(chunks.some((chunk) => chunk.kind === "citation")).toBe(true);
		expect(chunks.some((chunk) => chunk.kind === "text-delta")).toBe(true);
	});

	it("LSA-CT52: assembleResponse cohere response-citations yields typed citation StreamEvent", () => {
		const events = assembleResponse(cohereJSONFixture("response-citations"), cohereAdapter());
		expect(events.some((event) => event.type === "citation")).toBe(true);
		expect(
			(events.find((event) => event.type === "citation") as { span?: { text?: string } })?.span
				?.text,
		).toBe("gym memberships");
	});

	it("LSA-CT53: Vertex emitLegacyCitationMetadata preserves envelope-wrapped candidate metadata", () => {
		const chunks = geminiAdapter({
			apiSurface: "vertex",
			emitLegacyCitationMetadata: true,
		}).parseChunk(
			payload({
				response: {
					candidates: [
						{
							index: 0,
							groundingMetadata: { webSearchQueries: ["vertex-legacy"] },
							content: { parts: [{ text: "x" }] },
						},
					],
				},
			}),
		);
		expect(chunks.some((chunk) => chunk.kind === "grounding")).toBe(true);
		expect(chunks.some((chunk) => chunk.kind === "metadata")).toBe(true);
	});

	it("LSA-CT54: citation and grounding events survive pre-finish interleave with usage", async () => {
		async function* payloads() {
			yield payload({
				citations: ["https://usage.test"],
				choices: [{ delta: { content: "text" }, finish_reason: "stop" }],
				usage: { prompt_tokens: 1, completion_tokens: 2 },
			});
		}
		const events = await collectAsync(
			assembleFromPayloads(payloads(), openaiCompatibleAdapter({ provider: "perplexity" })),
		);
		const citationIndex = events.findIndex((event) => event.type === "citation");
		const usageIndex = events.findIndex((event) => event.type === "usage");
		const finishIndex = events.findIndex((event) => event.type === "finish");
		expect(citationIndex).toBeGreaterThanOrEqual(0);
		expect(usageIndex).toBeGreaterThan(citationIndex);
		expect(finishIndex).toBeGreaterThan(usageIndex);
	});

	it("LSA-CT55: post-finish grounding dropped through createAssemblyTransform", async () => {
		const transform = createAssemblyTransform(geminiAdapter());
		const collected = collectAsync(transform.readable);
		const writer = transform.writable.getWriter();
		await writer.write(
			new TextEncoder().encode(
				`data: ${JSON.stringify({
					candidates: [{ index: 0, finishReason: "STOP", content: { parts: [] } }],
				})}\n\n`,
			),
		);
		await writer.write(
			new TextEncoder().encode(
				`data: ${JSON.stringify({
					candidates: [
						{
							index: 0,
							groundingMetadata: { webSearchQueries: ["late-transform"] },
							content: { parts: [] },
						},
					],
				})}\n\n`,
			),
		);
		await writer.write(new TextEncoder().encode("data: [DONE]\n\n"));
		await writer.close();
		const events = await collected;
		expect(events.some((event) => event.type === "grounding")).toBe(false);
	});
});
