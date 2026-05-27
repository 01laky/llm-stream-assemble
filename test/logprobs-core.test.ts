import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
	logprobChunksFromChoiceLogprobs,
	logprobEntryFromProvider,
} from "../src/adapters/shared/logprobs";
import { openaiChatAdapter } from "../src/adapters/openai-chat";
import { createAssemblyTransform } from "../src/core/create-assembly-transform";
import { EventAssembler } from "../src/core/assembler/event-assembler";
import type { StreamEvent, StreamEventType } from "../src/core/types";
import { matchEvent } from "../src/helpers/match-event";
import { isLogprob } from "../src/helpers/type-guards";
import { collectStream } from "../src/transforms/collect-stream";
import { toSSE } from "../src/transforms/to-sse";
import { runAdapterGoldenStream } from "./helpers/adapter-conformance";
import { collectAsync } from "./helpers/collect-events";
import { expectedOpenAIEvents, normalizeEvents } from "./helpers/openai-fixtures";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const fixturesDir = join(rootDir, "test/fixtures/openai-chat");
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

describe("logprobs core", () => {
	it("LSA-LP01: EventAssembler emits logprob from logprob RawChunk", () => {
		const assembler = new EventAssembler();
		expect(
			assembler.push({
				kind: "logprob",
				channel: "content",
				token: "Hi",
				logprob: -0.1,
			}),
		).toEqual([
			{
				type: "logprob",
				channel: "content",
				token: "Hi",
				logprob: -0.1,
			},
		]);
	});

	it("LSA-LP02: post-finish logprob RawChunk dropped after finish", () => {
		const assembler = new EventAssembler();
		assembler.flush({ terminalReason: "stop" });
		expect(
			assembler.push({
				kind: "logprob",
				channel: "content",
				token: "late",
				logprob: -0.1,
			}),
		).toEqual([]);
	});

	it("LSA-LP03: content channel logprobs emit before refusal on same choice", () => {
		const chunks = openaiChatAdapter().parseChunk(
			payload({
				choices: [
					{
						index: 0,
						delta: { content: "x", refusal: "n" },
						logprobs: {
							content: [{ token: "c", logprob: -0.1 }],
							refusal: [{ token: "r", logprob: -0.2 }],
						},
					},
				],
			}),
		);
		expect(chunks.map((chunk) => chunk.kind)).toEqual([
			"logprob",
			"logprob",
			"text-delta",
			"refusal-delta",
		]);
		expect((chunks[0] as { channel?: string }).channel).toBe("content");
		expect((chunks[1] as { channel?: string }).channel).toBe("refusal");
	});

	it("LSA-LP04: collectStream appends logprobs array", async () => {
		const logprob = {
			type: "logprob" as const,
			channel: "content" as const,
			token: "a",
			logprob: -0.1,
		};
		const result = await collectStream(events(logprob));
		expect(result.logprobs).toEqual([logprob]);
	});

	it("LSA-LP05: matchEvent dispatches logprob handler", () => {
		const event = {
			type: "logprob" as const,
			channel: "content" as const,
			token: "a",
			logprob: -0.1,
		};
		expect(matchEvent(event, { logprob: (e) => e.token })).toBe("a");
	});

	it("LSA-LP06: isLogprob type guard", () => {
		expect(
			isLogprob({
				type: "logprob",
				channel: "content",
				token: "a",
				logprob: -0.1,
			}),
		).toBe(true);
		expect(isLogprob({ type: "text.delta", text: "x" })).toBe(false);
	});

	it("LSA-LP07: top_logprobs normalized to topLogprobs camelCase", () => {
		const chunk = logprobEntryFromProvider(
			{
				token: "a",
				logprob: -0.1,
				top_logprobs: [
					{ token: "a", logprob: -0.1 },
					{ token: "b", logprob: -0.5 },
				],
			},
			"content",
		);
		expect(chunk).toMatchObject({
			kind: "logprob",
			topLogprobs: [
				{ token: "a", logprob: -0.1 },
				{ token: "b", logprob: -0.5 },
			],
		});
	});

	it("LSA-LP08: bytes array preserved when present", () => {
		const chunk = logprobEntryFromProvider({ token: "!", logprob: -0.01, bytes: [33] }, "content");
		expect(chunk).toMatchObject({ bytes: [33] });
	});

	it("LSA-LP09: toSSE serializes logprob event JSON", async () => {
		const output = await readStream(
			toSSE(
				events({
					type: "logprob",
					channel: "content",
					token: "Hi",
					logprob: -0.1,
				}),
			),
		);
		expect(output).toContain('"type":"logprob"');
		expect(output).toContain('"token":"Hi"');
	});

	it("LSA-LP10: empty logprobs.content array emits no logprob chunks", () => {
		const chunks = logprobChunksFromChoiceLogprobs({ content: [] });
		expect(chunks).toEqual([]);
	});

	it("LSA-LP11: logprobs null emits no logprob chunks", () => {
		expect(logprobChunksFromChoiceLogprobs(null)).toEqual([]);
	});

	it("LSA-LP12: multiple entries in one chunk emit multiple events in order", () => {
		const chunks = logprobChunksFromChoiceLogprobs({
			content: [
				{ token: "a", logprob: -0.1 },
				{ token: "b", logprob: -0.2 },
			],
		});
		const assembler = new EventAssembler();
		const emitted = chunks.flatMap((chunk) => assembler.push(chunk));
		expect(emitted.map((event) => (event as { token?: string }).token)).toEqual(["a", "b"]);
	});

	it("LSA-LP13: channel refusal from logprobs.refusal array", () => {
		const chunks = logprobChunksFromChoiceLogprobs({
			refusal: [{ token: "No", logprob: -0.05 }],
		});
		expect(chunks).toEqual([
			expect.objectContaining({ kind: "logprob", channel: "refusal", token: "No" }),
		]);
	});

	it("LSA-LP14: choiceIndex forwarded from choice", () => {
		const chunks = logprobChunksFromChoiceLogprobs({ content: [{ token: "a", logprob: -0.1 }] }, 1);
		expect(chunks[0]).toMatchObject({ choiceIndex: 1 });
	});

	it("LSA-LP15: raw retains full provider entry", () => {
		const entry = { token: "x", logprob: -0.1, extra: true };
		const chunk = logprobEntryFromProvider(entry, "content");
		expect((chunk as { raw?: unknown }).raw).toEqual(entry);
	});

	it("LSA-LP16: dist index.d.ts exports logprob StreamEvent", () => {
		const dts = readFileSync(join(rootDir, "dist/index.d.ts"), "utf8");
		expect(dts).toMatch(/type:\s*"logprob"/);
	});

	it("LSA-LP17: StreamEventType union includes logprob", () => {
		const types: StreamEventType[] = ["logprob"];
		expect(types).toEqual(["logprob"]);
	});

	it("LSA-LP18: logprobs-tool-stream tool chunks with logprobs null emit no logprob", async () => {
		const events = normalizeEvents(
			await runAdapterGoldenStream({
				adapter: openaiChatAdapter(),
				fixtureSsePath: join(fixturesDir, "logprobs-tool-stream.sse"),
				expectedEventsPath: join(fixturesDir, "logprobs-tool-stream.expected.json"),
			}),
		);
		expect(events).toEqual(expectedOpenAIEvents("logprobs-tool-stream"));
		expect(events.filter((event) => event.type === "logprob")).toHaveLength(1);
	});

	it("LSA-LP19: jsonMode logprobs-json-mode golden emits logprob before json.delta", async () => {
		const events = normalizeEvents(
			await runAdapterGoldenStream({
				adapter: openaiChatAdapter({ jsonMode: true }),
				fixtureSsePath: join(fixturesDir, "logprobs-json-mode.sse"),
				expectedEventsPath: join(fixturesDir, "logprobs-json-mode.expected.json"),
			}),
		);
		expect(events).toEqual(expectedOpenAIEvents("logprobs-json-mode"));
		const logprobIndex = events.findIndex((event) => event.type === "logprob");
		const jsonIndex = events.findIndex((event) => event.type === "json.delta");
		expect(logprobIndex).toBeGreaterThanOrEqual(0);
		expect(jsonIndex).toBeGreaterThan(logprobIndex);
	});

	it("LSA-LP20: optionalEvent omits empty optional fields on logprob", () => {
		const assembler = new EventAssembler();
		const [event] = assembler.push({
			kind: "logprob",
			channel: "content",
			token: "x",
			logprob: -0.1,
		});
		expect(event).toEqual({
			type: "logprob",
			channel: "content",
			token: "x",
			logprob: -0.1,
		});
		expect("bytes" in event).toBe(false);
		expect("topLogprobs" in event).toBe(false);
	});

	it("LSA-LP21: createAssemblyTransform passes logprob events", async () => {
		const sse = readFileSync(join(fixturesDir, "logprobs-stream.sse"), "utf8");
		const transform = createAssemblyTransform(openaiChatAdapter());
		const collected = collectAsync(transform.readable);
		const writer = transform.writable.getWriter();
		for (const line of sse.split("\n\n")) {
			if (!line.trim()) continue;
			await writer.write(new TextEncoder().encode(`${line}\n\n`));
		}
		await writer.close();
		const result = await collected;
		expect(result.some((event) => event.type === "logprob")).toBe(true);
	});

	it("LSA-LP22: transform pipeline preserves logprob-before-text order", async () => {
		const sse = readFileSync(join(fixturesDir, "logprobs-stream.sse"), "utf8");
		const transform = createAssemblyTransform(openaiChatAdapter());
		const collected = collectAsync(transform.readable);
		const writer = transform.writable.getWriter();
		for (const line of sse.split("\n\n")) {
			if (!line.trim()) continue;
			await writer.write(new TextEncoder().encode(`${line}\n\n`));
		}
		await writer.close();
		const result = await collected;
		const logprobIndex = result.findIndex((event) => event.type === "logprob");
		const textIndex = result.findIndex((event) => event.type === "text.delta");
		expect(logprobIndex).toBeGreaterThanOrEqual(0);
		expect(textIndex).toBeGreaterThan(logprobIndex);
	});

	it("LSA-LP23: transform pipeline drops post-finish logprob", async () => {
		const transform = createAssemblyTransform(openaiChatAdapter());
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
			new TextEncoder().encode(
				`data: ${JSON.stringify({
					choices: [
						{
							delta: {},
							logprobs: {
								content: [{ token: "late", logprob: -0.1 }],
							},
						},
					],
				})}\n\n`,
			),
		);
		await writer.write(new TextEncoder().encode("data: [DONE]\n\n"));
		await writer.close();
		const result = await collected;
		expect(result.some((event) => event.type === "logprob")).toBe(false);
	});

	it("LSA-LP24: multichoice golden matches expected choiceIndex", async () => {
		const events = normalizeEvents(
			await runAdapterGoldenStream({
				adapter: openaiChatAdapter(),
				fixtureSsePath: join(fixturesDir, "logprobs-multichoice.sse"),
				expectedEventsPath: join(fixturesDir, "logprobs-multichoice.expected.json"),
			}),
		);
		expect(events).toEqual(expectedOpenAIEvents("logprobs-multichoice"));
	});

	it("LSA-LP25: refusal channel golden matches expected", async () => {
		const events = normalizeEvents(
			await runAdapterGoldenStream({
				adapter: openaiChatAdapter(),
				fixtureSsePath: join(fixturesDir, "logprobs-refusal.sse"),
				expectedEventsPath: join(fixturesDir, "logprobs-refusal.expected.json"),
			}),
		);
		expect(events).toEqual(expectedOpenAIEvents("logprobs-refusal"));
		expect(
			events
				.filter((event) => event.type === "logprob")
				.every((event) => event.channel === "refusal"),
		).toBe(true);
	});

	it("LSA-LP26: toSSE round-trip preserves type logprob with text and finish", async () => {
		const output = await readStream(
			toSSE(
				events(
					{
						type: "logprob",
						channel: "content",
						token: "a",
						logprob: -0.1,
					},
					{ type: "text.delta", text: "a" },
					{ type: "finish", reason: "stop" },
				),
			),
		);
		const lines = output.split("\n").filter((line) => line.startsWith("data: "));
		expect(lines.some((line) => line.includes('"type":"logprob"'))).toBe(true);
		expect(lines.some((line) => line.includes('"type":"text.delta"'))).toBe(true);
	});

	it("LSA-LP27: sanitizeErrors does not alter logprob serialization", async () => {
		const output = await readStream(
			toSSE(
				events({
					type: "logprob",
					channel: "content",
					token: "safe",
					logprob: -0.1,
				}),
				{ sanitizeErrors: true },
			),
		);
		expect(output).toContain('"type":"logprob"');
	});

	it("LSA-LP28: matchEvent with empty handlers returns undefined for logprob", () => {
		expect(
			matchEvent(
				{
					type: "logprob",
					channel: "content",
					token: "x",
					logprob: -0.1,
				},
				{},
			),
		).toBeUndefined();
	});

	it("LSA-LP29: partial handlers ignore logprob when no handler registered", () => {
		expect(
			matchEvent(
				{
					type: "logprob",
					channel: "content",
					token: "x",
					logprob: -0.1,
				},
				{
					"text.delta": () => "text",
				},
			),
		).toBeUndefined();
	});
});
