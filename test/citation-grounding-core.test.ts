import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { cohereAdapter } from "../src/adapters/cohere";
import { geminiAdapter } from "../src/adapters/gemini";
import { openaiCompatibleAdapter } from "../src/adapters/openai-compatible";
import { createAssemblyTransform } from "../src/core/create-assembly-transform";
import { EventAssembler } from "../src/core/assembler/event-assembler";
import type { StreamEvent, StreamEventType } from "../src/core/types";
import { matchEvent } from "../src/helpers/match-event";
import { isCitation, isGrounding } from "../src/helpers/type-guards";
import { collectStream } from "../src/transforms/collect-stream";
import { toSSE } from "../src/transforms/to-sse";
import { collectAsync } from "./helpers/collect-events";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

async function* events(...items: StreamEvent[]): AsyncIterable<StreamEvent> {
	for (const item of items) yield item;
}

async function readStream(stream: ReadableStream<Uint8Array>): Promise<string> {
	const reader = stream.getReader();
	const decoder = new TextDecoder();
	let output = "";
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		output += decoder.decode(value);
	}
	return output;
}

describe("citation and grounding core", () => {
	it("LSA-CT01: EventAssembler emits citation from citation RawChunk", () => {
		const assembler = new EventAssembler();
		expect(assembler.push({ kind: "citation", urls: ["https://a.test"] })).toEqual([
			{ type: "citation", urls: ["https://a.test"] },
		]);
	});

	it("LSA-CT02: EventAssembler emits grounding from grounding RawChunk", () => {
		const assembler = new EventAssembler();
		expect(
			assembler.push({
				kind: "grounding",
				queries: ["weather"],
				chunks: [{ web: { uri: "https://a.test" } }],
			}),
		).toEqual([
			{
				type: "grounding",
				queries: ["weather"],
				chunks: [{ web: { uri: "https://a.test" } }],
			},
		]);
	});

	it("LSA-CT03: post-finish citation RawChunk dropped after finish", () => {
		const assembler = new EventAssembler();
		assembler.flush({ terminalReason: "stop" });
		expect(assembler.push({ kind: "citation", urls: ["https://late.test"] })).toEqual([]);
	});

	it("LSA-CT04: post-finish grounding RawChunk dropped after finish", () => {
		const assembler = new EventAssembler();
		assembler.flush({ terminalReason: "stop" });
		expect(assembler.push({ kind: "grounding", queries: ["late"] })).toEqual([]);
	});

	it("LSA-CT05: collectStream appends citations and grounding arrays", async () => {
		const citation = { type: "citation" as const, urls: ["https://a.test"] };
		const grounding = { type: "grounding" as const, queries: ["q"] };
		const result = await collectStream(events(citation, grounding));
		expect(result.citations).toEqual([citation]);
		expect(result.grounding).toEqual([grounding]);
	});

	it("LSA-CT06: matchEvent dispatches citation handler", () => {
		const event = { type: "citation" as const, urls: ["https://a.test"] };
		expect(matchEvent(event, { citation: (e) => e.urls?.[0] })).toBe("https://a.test");
	});

	it("LSA-CT07: matchEvent dispatches grounding handler", () => {
		const event = { type: "grounding" as const, queries: ["weather"] };
		expect(matchEvent(event, { grounding: (e) => e.queries?.[0] })).toBe("weather");
	});

	it("LSA-CT08: isCitation and isGrounding type guards", () => {
		expect(isCitation({ type: "citation", urls: [] })).toBe(true);
		expect(isGrounding({ type: "grounding", queries: [] })).toBe(true);
		expect(isCitation({ type: "text.delta", text: "x" })).toBe(false);
		expect(isGrounding({ type: "metadata" })).toBe(false);
	});

	it("LSA-CT09: toSSE serializes citation event JSON", async () => {
		const output = await readStream(toSSE(events({ type: "citation", urls: ["https://a.test"] })));
		expect(output).toContain('"type":"citation"');
		expect(output).toContain("https://a.test");
	});

	it("LSA-CT10: toSSE serializes grounding event JSON", async () => {
		const output = await readStream(
			toSSE(events({ type: "grounding", queries: ["weather Boston"] })),
		);
		expect(output).toContain('"type":"grounding"');
		expect(output).toContain("weather Boston");
	});

	it("LSA-CT11: citation with only urls normalizes", () => {
		const assembler = new EventAssembler();
		expect(assembler.push({ kind: "citation", urls: ["https://only.test"] })).toEqual([
			{ type: "citation", urls: ["https://only.test"] },
		]);
	});

	it("LSA-CT12: citation with span and sources normalizes", () => {
		const assembler = new EventAssembler();
		const sources = [{ id: "doc:1" }];
		expect(
			assembler.push({
				kind: "citation",
				span: { start: 0, end: 3, text: "abc" },
				sources,
			}),
		).toEqual([
			{
				type: "citation",
				span: { start: 0, end: 3, text: "abc" },
				sources,
			},
		]);
	});

	it("LSA-CT13: grounding with queries and chunks normalizes", () => {
		const assembler = new EventAssembler();
		const chunks = [{ web: { uri: "https://a.test" } }];
		expect(assembler.push({ kind: "grounding", queries: ["q1"], chunks })).toEqual([
			{ type: "grounding", queries: ["q1"], chunks },
		]);
	});

	it("LSA-CT14: empty citation optional fields omitted via optionalEvent", () => {
		const assembler = new EventAssembler();
		const [event] = assembler.push({ kind: "citation", raw: { citations: [] } });
		expect(event).toEqual({ type: "citation", raw: { citations: [] } });
		expect("urls" in event).toBe(false);
	});

	it("LSA-CT15: multiple citations in one Cohere stream preserve order", async () => {
		const payload = (value: unknown) => JSON.stringify(value);
		async function* lines() {
			yield payload({
				type: "citation-start",
				index: 0,
				delta: { message: { citations: { start: 0, end: 1, text: "a" } } },
			});
			yield payload({
				type: "citation-start",
				index: 1,
				delta: { message: { citations: { start: 2, end: 3, text: "b" } } },
			});
		}
		const events = await collectAsync(
			(await import("../src/core/assemble-payloads")).assembleFromPayloads(
				lines(),
				cohereAdapter(),
			),
		);
		const citations = events.filter((event) => event.type === "citation");
		expect(citations).toHaveLength(2);
		expect((citations[0] as { span?: { text?: string } }).span?.text).toBe("a");
		expect((citations[1] as { span?: { text?: string } }).span?.text).toBe("b");
	});

	it("LSA-CT16: Gemini candidate emits citation then grounding then text", () => {
		const chunks = geminiAdapter().parseChunk(
			JSON.stringify({
				candidates: [
					{
						index: 0,
						citationMetadata: { citations: [{ uri: "urn:x" }] },
						groundingMetadata: { webSearchQueries: ["q"] },
						content: { parts: [{ text: "answer" }] },
					},
				],
			}),
		);
		expect(chunks.map((chunk) => chunk.kind)).toEqual(["citation", "grounding", "text-delta"]);
	});

	it("LSA-CT17: dist index.d.ts exports StreamEvent includes citation and grounding", () => {
		const dts = readFileSync(join(rootDir, "dist/index.d.ts"), "utf8");
		expect(dts).toMatch(/type:\s*"citation"/);
		expect(dts).toMatch(/type:\s*"grounding"/);
	});

	it("LSA-CT18: StreamEventType union includes citation and grounding", () => {
		const types: StreamEventType[] = ["citation", "grounding"];
		expect(types).toEqual(["citation", "grounding"]);
	});

	it("LSA-CT19: emitLegacyCitationMetadata true dual-emits citation and legacy metadata", () => {
		const chunks = openaiCompatibleAdapter({
			provider: "perplexity",
			emitLegacyCitationMetadata: true,
		}).parseChunk(
			JSON.stringify({
				citations: ["https://legacy.test"],
				choices: [{ delta: { content: "x" } }],
			}),
		);
		expect(chunks.some((chunk) => chunk.kind === "citation")).toBe(true);
		expect(
			chunks.some(
				(chunk) =>
					chunk.kind === "metadata" &&
					"citations" in ((chunk as { raw?: Record<string, unknown> }).raw ?? {}),
			),
		).toBe(true);
	});

	it("LSA-CT20: default false — citation only, no legacy metadata duplicate", () => {
		const chunks = openaiCompatibleAdapter({ provider: "perplexity" }).parseChunk(
			JSON.stringify({
				citations: ["https://only-typed.test"],
				choices: [{ delta: { content: "x" } }],
			}),
		);
		expect(chunks.filter((chunk) => chunk.kind === "citation")).toHaveLength(1);
		expect(chunks.some((chunk) => chunk.kind === "metadata")).toBe(false);
	});

	it("LSA-CT21: createAssemblyTransform passes Cohere citation events", async () => {
		const transform = createAssemblyTransform(cohereAdapter());
		const collected = collectAsync(transform.readable);
		const writer = transform.writable.getWriter();
		await writer.write(
			new TextEncoder().encode(
				`data: ${JSON.stringify({
					type: "citation-start",
					index: 0,
					delta: { message: { citations: { start: 0, end: 2, text: "hi" } } },
				})}\n\n`,
			),
		);
		await writer.write(new TextEncoder().encode("data: [DONE]\n\n"));
		await writer.close();
		const result = await collected;
		expect(result.some((event) => event.type === "citation")).toBe(true);
	});

	it("LSA-CT22: transform pipeline preserves Perplexity citation-before-text order", async () => {
		const transform = createAssemblyTransform(openaiCompatibleAdapter({ provider: "perplexity" }));
		const collected = collectAsync(transform.readable);
		const writer = transform.writable.getWriter();
		await writer.write(
			new TextEncoder().encode(
				`data: ${JSON.stringify({
					citations: ["https://order.test"],
					choices: [{ delta: { content: "text" } }],
				})}\n\n`,
			),
		);
		await writer.write(new TextEncoder().encode("data: [DONE]\n\n"));
		await writer.close();
		const result = await collected;
		const citationIndex = result.findIndex((event) => event.type === "citation");
		const textIndex = result.findIndex((event) => event.type === "text.delta");
		expect(citationIndex).toBeGreaterThanOrEqual(0);
		expect(textIndex).toBeGreaterThan(citationIndex);
	});

	it("LSA-CT23: transform pipeline drops post-finish citation", async () => {
		const transform = createAssemblyTransform(openaiCompatibleAdapter({ provider: "perplexity" }));
		const collected = collectAsync(transform.readable);
		const writer = transform.writable.getWriter();
		await writer.write(
			new TextEncoder().encode(
				`data: ${JSON.stringify({
					choices: [{ delta: { content: "done" }, finish_reason: "stop" }],
				})}\n\n`,
			),
		);
		await writer.write(
			new TextEncoder().encode(`data: ${JSON.stringify({ citations: ["https://late.test"] })}\n\n`),
		);
		await writer.write(new TextEncoder().encode("data: [DONE]\n\n"));
		await writer.close();
		const result = await collected;
		expect(result.some((event) => event.type === "citation")).toBe(false);
	});

	it('LSA-CT24: toSSE JSON line preserves type: "citation"', async () => {
		const output = await readStream(
			toSSE(events({ type: "citation", urls: ["https://roundtrip.test"] })),
		);
		const line = output.split("\n").find((row) => row.startsWith("data: "));
		expect(line).toContain('"type":"citation"');
	});

	it('LSA-CT25: toSSE JSON line preserves type: "grounding"', async () => {
		const output = await readStream(toSSE(events({ type: "grounding", queries: ["roundtrip"] })));
		const line = output.split("\n").find((row) => row.startsWith("data: "));
		expect(line).toContain('"type":"grounding"');
	});

	it("LSA-CT26: sanitizeErrors does not alter citation or grounding serialization", async () => {
		const output = await readStream(
			toSSE(
				events(
					{ type: "citation", urls: ["https://safe.test"] },
					{ type: "grounding", queries: ["safe"] },
				),
				{ sanitizeErrors: true },
			),
		);
		expect(output).toContain('"type":"citation"');
		expect(output).toContain('"type":"grounding"');
	});

	it("LSA-CT27: matchEvent with empty handlers returns undefined for citation", () => {
		expect(matchEvent({ type: "citation", urls: [] }, {})).toBeUndefined();
	});

	it("LSA-CT28: partial handlers — citation ignored when no handler registered", () => {
		expect(
			matchEvent(
				{ type: "citation", urls: ["https://ignored.test"] },
				{
					"text.delta": () => "text",
				},
			),
		).toBeUndefined();
	});

	it("LSA-CT29: legacy switch default-break pattern smoke — unknown event types exhaust never", () => {
		const event = { type: "citation" as const, urls: ["https://default.test"] };
		expect(matchEvent(event, { citation: () => "ok" })).toBe("ok");
		expect(matchEvent(event, {})).toBeUndefined();
	});
});
