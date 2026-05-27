import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
	logprobChunksFromResponsesLogprobs,
	logprobEntryFromProvider,
} from "../src/adapters/shared/logprobs";
import { openaiResponsesAdapter } from "../src/adapters/openai-responses";
import { assembleResponse } from "../src/core/assemble-response";
import { createAssemblyTransform } from "../src/core/create-assembly-transform";
import { EventAssembler } from "../src/core/assembler/event-assembler";
import { assembleStream } from "../src/core/assemble-stream";
import type { StreamEvent } from "../src/core/types";
import { matchEvent } from "../src/helpers/match-event";
import { isLogprob } from "../src/helpers/type-guards";
import { collectStream } from "../src/transforms/collect-stream";
import { toSSE } from "../src/transforms/to-sse";
import { byteStreamFromStrings, collectAsync } from "./helpers/collect-events";
import {
	expectedResponsesEvents,
	normalizeResponsesEvents,
	responsesJSONFixture,
	responsesTextFixture,
} from "./helpers/responses-fixtures";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const fixturesDir = join(rootDir, "test/fixtures/openai-responses");
const payload = (value: unknown) => JSON.stringify(value);

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

async function streamFixture(name: string, options?: { jsonMode?: boolean }) {
	return normalizeResponsesEvents(
		await collectAsync(
			assembleStream(
				byteStreamFromStrings(responsesTextFixture(name, "sse")),
				openaiResponsesAdapter(options),
			),
		),
	);
}

describe("responses logprobs core", () => {
	it("LSA-RL01: textDelta emits logprob RawChunk from logprobs[]", () => {
		const chunks = openaiResponsesAdapter().parseChunk(
			payload({
				type: "response.output_text.delta",
				delta: "Hi",
				logprobs: [{ token: "Hi", logprob: -0.1 }],
			}),
		);
		expect(chunks[0]).toMatchObject({ kind: "logprob", channel: "content", token: "Hi" });
	});

	it("LSA-RL02: post-finish logprob dropped by assembler", () => {
		const assembler = new EventAssembler();
		assembler.flush({ terminalReason: "stop" });
		expect(
			assembler.push({ kind: "logprob", channel: "content", token: "late", logprob: -0.1 }),
		).toEqual([]);
	});

	it("LSA-RL03: logprob before text.delta on same parseChunk result", () => {
		const kinds = openaiResponsesAdapter()
			.parseChunk(
				payload({
					type: "response.output_text.delta",
					delta: "x",
					logprobs: [{ token: "x", logprob: -0.1 }],
				}),
			)
			.map((chunk) => chunk.kind);
		expect(kinds).toEqual(["logprob", "text-delta"]);
	});

	it("LSA-RL04: collectStream accumulates Responses logprobs", async () => {
		const events = await collectAsync(
			assembleStream(
				byteStreamFromStrings(responsesTextFixture("logprobs-stream", "sse")),
				openaiResponsesAdapter(),
			),
		);
		const collected = await collectStream(
			(async function* () {
				for (const event of events) yield event;
			})(),
		);
		expect(collected.logprobs.length).toBe(2);
	});

	it("LSA-RL05: matchEvent and isLogprob work on Responses-assembled events", async () => {
		const events = await collectAsync(
			assembleStream(
				byteStreamFromStrings(responsesTextFixture("logprobs-stream", "sse")),
				openaiResponsesAdapter(),
			),
		);
		const logprob = events.find(isLogprob);
		expect(logprob).toBeDefined();
		expect(matchEvent(logprob!, { logprob: (event) => event.token })).toBe("Hello");
	});

	it("LSA-RL06: empty logprobs array emits no logprob chunks", () => {
		const chunks = openaiResponsesAdapter().parseChunk(
			payload({ type: "response.output_text.delta", delta: "x", logprobs: [] }),
		);
		expect(chunks.every((chunk) => chunk.kind !== "logprob")).toBe(true);
	});

	it("LSA-RL07: missing logprobs key emits no logprob chunks", () => {
		const chunks = openaiResponsesAdapter().parseChunk(
			payload({ type: "response.output_text.delta", delta: "x" }),
		);
		expect(chunks.every((chunk) => chunk.kind !== "logprob")).toBe(true);
	});

	it("LSA-RL08: top_logprobs normalized to topLogprobs", () => {
		const chunks = openaiResponsesAdapter().parseChunk(
			payload({
				type: "response.output_text.delta",
				delta: "a",
				logprobs: [
					{
						token: "a",
						logprob: -0.1,
						top_logprobs: [
							{ token: "a", logprob: -0.1 },
							{ token: "b", logprob: -0.5 },
						],
					},
				],
			}),
		);
		expect((chunks[0] as { topLogprobs?: unknown[] }).topLogprobs).toHaveLength(2);
	});

	it("LSA-RL09: bytes preserved on logprob chunk", () => {
		const chunks = openaiResponsesAdapter().parseChunk(
			payload({
				type: "response.output_text.delta",
				delta: "A",
				logprobs: [{ token: "A", logprob: -0.1, bytes: [65] }],
			}),
		);
		expect((chunks[0] as { bytes?: number[] }).bytes).toEqual([65]);
	});

	it("LSA-RL10: toSSE serializes Responses-sourced logprob", async () => {
		const output = await readStream(
			toSSE(
				events({
					type: "logprob",
					channel: "content",
					token: "Hello",
					logprob: -0.12,
				}),
			),
		);
		expect(output).toContain('"type":"logprob"');
	});

	it("LSA-RL11: new adapter instance resets logprob position counters", async () => {
		await streamFixture("logprobs-stream");
		const events = await streamFixture("logprobs-done-batch");
		const positions = events
			.filter((event) => (event as { type?: string }).type === "logprob")
			.map((event) => (event as { position?: number }).position);
		expect(positions).toEqual([0, 1]);
	});

	it("LSA-RL12: done-batch after deltas emits no duplicate logprobs on done", async () => {
		const events = await streamFixture("logprobs-stream");
		const logprobs = events.filter((event) => (event as { type?: string }).type === "logprob");
		expect(logprobs).toHaveLength(2);
	});

	it("LSA-RL13: done-only stream emits logprobs before text", async () => {
		const events = await streamFixture("logprobs-done-batch");
		const types = events.map((event) => (event as { type?: string }).type);
		const firstLogprob = types.indexOf("logprob");
		const firstText = types.findIndex((type) => type === "text.delta" || type === "text.done");
		expect(firstLogprob).toBeGreaterThanOrEqual(0);
		expect(firstLogprob).toBeLessThan(firstText);
	});

	it("LSA-RL14: refusal delta logprobs use refusal channel", async () => {
		const events = await streamFixture("logprobs-refusal");
		const refusalLogprob = events.find(
			(event) =>
				(event as { type?: string }).type === "logprob" &&
				(event as { channel?: string }).channel === "refusal",
		);
		expect(refusalLogprob).toBeDefined();
	});

	it("LSA-RL15: jsonMode logprob before json.delta", async () => {
		const events = await streamFixture("logprobs-json-mode", { jsonMode: true });
		const types = events.map((event) => (event as { type?: string }).type);
		expect(types.indexOf("logprob")).toBeLessThan(types.indexOf("json.delta"));
	});

	it("LSA-RL16: parseResponse logprobs on output_text part", () => {
		const chunks = openaiResponsesAdapter().parseResponse!(
			responsesJSONFixture("logprobs-response"),
		);
		expect(chunks.filter((chunk) => chunk.kind === "logprob")).toHaveLength(2);
	});

	it("LSA-RL17: assembleResponse typed logprob events", () => {
		const events = normalizeResponsesEvents(
			assembleResponse(responsesJSONFixture("logprobs-response"), openaiResponsesAdapter()),
		);
		expect(events.some((event) => (event as { type?: string }).type === "logprob")).toBe(true);
	});

	it("LSA-RL18: non-stream logprob count matches array length", () => {
		const events = normalizeResponsesEvents(
			assembleResponse(responsesJSONFixture("logprobs-response"), openaiResponsesAdapter()),
		);
		expect(events.filter((event) => (event as { type?: string }).type === "logprob")).toHaveLength(
			2,
		);
	});

	it("LSA-RL19: output_index maps to choiceIndex when non-zero", async () => {
		const events = await streamFixture("logprobs-multi-output");
		const withChoice = events.filter(
			(event) =>
				(event as { type?: string }).type === "logprob" &&
				(event as { choiceIndex?: number }).choiceIndex === 1,
		);
		expect(withChoice.length).toBeGreaterThan(0);
	});

	it("LSA-RL20: non-stream position equals array index", () => {
		const events = normalizeResponsesEvents(
			assembleResponse(responsesJSONFixture("logprobs-response"), openaiResponsesAdapter()),
		);
		const positions = events
			.filter((event) => (event as { type?: string }).type === "logprob")
			.map((event) => (event as { position?: number }).position);
		expect(positions).toEqual([0, 1]);
	});

	it("LSA-RL21: transform pipeline order preserved", async () => {
		const sse = readFileSync(join(fixturesDir, "logprobs-stream.sse"), "utf8");
		const transform = createAssemblyTransform(openaiResponsesAdapter());
		const collected = collectAsync(transform.readable);
		const writer = transform.writable.getWriter();
		for (const line of sse.split("\n\n")) {
			if (!line.trim()) continue;
			await writer.write(new TextEncoder().encode(`${line}\n\n`));
		}
		await writer.close();
		const result = normalizeResponsesEvents(await collected);
		expect(result).toEqual(expectedResponsesEvents("logprobs-stream"));
	});

	it("LSA-RL22: transform post-finish drop", async () => {
		const transform = createAssemblyTransform(openaiResponsesAdapter());
		const collected = collectAsync(transform.readable);
		const writer = transform.writable.getWriter();
		await writer.write(
			new TextEncoder().encode(
				`data: ${JSON.stringify({ type: "response.completed", response: { status: "completed" } })}\n\n`,
			),
		);
		await writer.write(
			new TextEncoder().encode(
				`data: ${JSON.stringify({
					type: "response.output_text.delta",
					delta: "late",
					logprobs: [{ token: "late", logprob: -0.1 }],
				})}\n\n`,
			),
		);
		await writer.close();
		const result = await collected;
		expect(result.some((event) => event.type === "logprob")).toBe(false);
	});

	it("LSA-RL23: output_index 0 omits choiceIndex after normalize", async () => {
		const events = await streamFixture("logprobs-stream");
		const logprob = events.find((event) => (event as { type?: string }).type === "logprob");
		expect(logprob).not.toHaveProperty("choiceIndex");
	});

	it("LSA-RL24: multiple logprobs in one delta emit in order", () => {
		const chunks = logprobChunksFromResponsesLogprobs(
			[
				{ token: "a", logprob: -0.1 },
				{ token: "b", logprob: -0.2 },
			],
			"content",
		);
		expect(chunks.map((chunk) => (chunk as { token?: string }).token)).toEqual(["a", "b"]);
	});

	it("LSA-RL25: raw retains full provider LogProb entry on chunk", () => {
		const entry = { token: "x", logprob: -0.1, extra: true };
		const chunk = logprobEntryFromProvider(entry, "content");
		expect((chunk as { raw?: unknown }).raw).toEqual(entry);
	});
});
