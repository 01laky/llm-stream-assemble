import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
	createLogprobPositionState,
	logprobChunksFromChoiceLogprobs,
	logprobEntryFromProvider,
	nextLogprobPosition,
	normalizeTopLogprobs,
} from "../src/adapters/shared/logprobs";
import { openaiChatAdapter } from "../src/adapters/openai-chat";
import { openaiCompatibleAdapter } from "../src/adapters/openai-compatible";
import { EventAssembler } from "../src/core/assembler/event-assembler";
import { assembleFromFile } from "../src/core/assemble-from-file";
import { assembleFromPayloads } from "../src/core/assemble-payloads";
import { assembleStream } from "../src/core/assemble-stream";
import { logprobConfidence } from "../src/helpers/logprob-confidence";
import { mapStreamEventToAISDKPart } from "../examples/integrations/stream-event-to-ai-sdk-parts";
import { collectStream } from "../src/transforms/collect-stream";
import { tapEvents } from "../src/transforms/tap-events";
import { runAdapterGoldenStream } from "./helpers/adapter-conformance";
import { byteStreamFromStrings, collectAsync } from "./helpers/collect-events";
import { expectedCompatibleEvents } from "./helpers/compatible-fixtures";
import {
	expectedOpenAIEvents,
	normalizeEvents,
	openAIJSONFixture,
} from "./helpers/openai-fixtures";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const openaiFixtures = join(rootDir, "test/fixtures/openai-chat");
const compatibleRoot = join(rootDir, "test/fixtures/openai-compatible");
const payload = (value: unknown) => JSON.stringify(value);

describe("logprobs extended edge cases", () => {
	it("LSA-LP30: missing token in entry skipped without throw", () => {
		const chunks = logprobChunksFromChoiceLogprobs({
			content: [{ logprob: -0.1 }, { token: "ok", logprob: -0.2 }],
		});
		expect(chunks).toHaveLength(1);
		expect(chunks[0]).toMatchObject({ token: "ok" });
	});

	it("LSA-LP31: missing or non-finite logprob in entry skipped", () => {
		expect(logprobEntryFromProvider({ token: "a" }, "content")).toBeUndefined();
		expect(
			logprobEntryFromProvider({ token: "b", logprob: Number.NaN }, "content"),
		).toBeUndefined();
	});

	it("LSA-LP32: malformed top_logprobs entries skipped individually", () => {
		const chunk = logprobEntryFromProvider(
			{
				token: "a",
				logprob: -0.1,
				top_logprobs: [{ token: "a", logprob: -0.1 }, { bad: true }, { token: "b", logprob: -0.5 }],
			},
			"content",
		);
		expect(chunk?.topLogprobs).toEqual([
			{ token: "a", logprob: -0.1 },
			{ token: "b", logprob: -0.5 },
		]);
	});

	it("LSA-LP33: unicode token preserved in logprob event", () => {
		const assembler = new EventAssembler();
		const [event] = assembler.push({
			kind: "logprob",
			channel: "content",
			token: "é",
			logprob: -0.1,
		});
		expect((event as { token?: string }).token).toBe("é");
	});

	it("LSA-LP34: very negative logprob preserved as number", () => {
		const chunk = logprobEntryFromProvider({ token: "x", logprob: -50 }, "content");
		expect((chunk as { logprob?: number }).logprob).toBe(-50);
	});

	it("LSA-LP35: tapEvents forwards logprob events unchanged", async () => {
		const logprob = {
			type: "logprob" as const,
			channel: "content" as const,
			token: "a",
			logprob: -0.1,
		};
		async function* source() {
			yield logprob;
		}
		const events = await collectAsync(tapEvents(source(), () => undefined));
		expect(events).toEqual([logprob]);
	});

	it("LSA-LP36: collectStream preserves logprob order with interleaved text", async () => {
		async function* source() {
			yield {
				type: "logprob" as const,
				channel: "content" as const,
				token: "a",
				logprob: -0.1,
			};
			yield { type: "text.delta" as const, text: "a" };
			yield {
				type: "logprob" as const,
				channel: "content" as const,
				token: "b",
				logprob: -0.2,
			};
			yield { type: "text.delta" as const, text: "b" };
		}
		const result = await collectStream(source());
		expect(result.logprobs.map((event) => event.token)).toEqual(["a", "b"]);
	});

	it("LSA-LP37: non-stream response logprobs precede text-delta", () => {
		const chunks = openaiChatAdapter().parseResponse!(openAIJSONFixture("logprobs-response"));
		const logprobIndex = chunks.findIndex((chunk) => chunk.kind === "logprob");
		const textIndex = chunks.findIndex((chunk) => chunk.kind === "text-delta");
		expect(logprobIndex).toBeGreaterThanOrEqual(0);
		expect(textIndex).toBeGreaterThan(logprobIndex);
	});

	it("LSA-LP38: strictToolArgs unaffected when logprob events present", async () => {
		const events = await collectAsync(
			assembleFromFile(join(openaiFixtures, "logprobs-tool-stream.sse"), openaiChatAdapter(), {
				strictToolArgs: true,
			}),
		);
		expect(events.some((event) => event.type === "logprob")).toBe(true);
		expect(events.some((event) => event.type === "tool_call.done")).toBe(true);
	});

	it("LSA-LP39: assembleFromFile logprobs-stream fixture replay", async () => {
		const events = normalizeEvents(
			await collectAsync(
				assembleFromFile(join(openaiFixtures, "logprobs-stream.sse"), openaiChatAdapter()),
			),
		);
		expect(events).toEqual(expectedOpenAIEvents("logprobs-stream"));
	});

	it("LSA-LP40: compatible root logprobs-stream golden", async () => {
		const events = normalizeEvents(
			await runAdapterGoldenStream({
				adapter: openaiCompatibleAdapter(),
				fixtureSsePath: join(compatibleRoot, "logprobs-stream.sse"),
				expectedEventsPath: join(compatibleRoot, "logprobs-stream.expected.json"),
			}),
		);
		expect(events).toEqual(expectedCompatibleEvents("logprobs-stream"));
	});

	it("LSA-LP41: azure preset tolerates logprobs without false metadata logprob", () => {
		const chunks = openaiCompatibleAdapter({ provider: "azure" }).parseChunk(
			payload({
				id: "chatcmpl_az",
				choices: [{ index: 0, delta: { role: "assistant" }, logprobs: null }],
			}),
		);
		expect(chunks.some((chunk) => chunk.kind === "logprob")).toBe(false);
		expect(chunks.some((chunk) => chunk.kind === "metadata")).toBe(true);
	});

	it("LSA-LP42: post-finish logprob dropped through tapEvents pipeline", async () => {
		const assembler = new EventAssembler();
		assembler.flush({ terminalReason: "stop" });
		async function* source() {
			for (const event of assembler.push({
				kind: "logprob",
				channel: "content",
				token: "late",
				logprob: -0.1,
			})) {
				yield event;
			}
		}
		const events = await collectAsync(tapEvents(source(), () => undefined));
		expect(events).toEqual([]);
	});

	it("LSA-LP43: multichoice logprobs only on choice 1 sets choiceIndex", async () => {
		const events = normalizeEvents(
			await collectAsync(
				assembleStream(
					byteStreamFromStrings(
						readFileSync(join(openaiFixtures, "logprobs-multichoice.sse"), "utf8"),
					),
					openaiChatAdapter(),
				),
			),
		);
		const byChoice = events.filter((event) => event.type === "logprob");
		expect(byChoice).toHaveLength(2);
		expect(byChoice[0]?.choiceIndex).toBeUndefined();
		expect(byChoice[1]?.choiceIndex).toBe(1);
	});

	it("LSA-LP44: logprobs without delta content emit logprob only", () => {
		const chunks = openaiChatAdapter().parseChunk(
			payload({
				choices: [
					{
						index: 0,
						delta: {},
						logprobs: { content: [{ token: "only", logprob: -0.1 }] },
					},
				],
			}),
		);
		expect(chunks.map((chunk) => chunk.kind)).toEqual(["logprob"]);
	});

	it("LSA-LP45: logprobConfidence integration on assembled logprob events", async () => {
		const events = normalizeEvents(
			await runAdapterGoldenStream({
				adapter: openaiChatAdapter(),
				fixtureSsePath: join(openaiFixtures, "logprobs-stream.sse"),
				expectedEventsPath: join(openaiFixtures, "logprobs-stream.expected.json"),
			}),
		);
		const first = events.find((event) => event.type === "logprob");
		expect(first).toBeDefined();
		if (!first || first.type !== "logprob") return;
		const confidence = logprobConfidence({
			logprob: first.logprob,
			topLogprobs: first.topLogprobs,
		});
		expect(confidence.probability).toBeDefined();
	});

	it("LSA-LP46: null logprob on one array entry skips entry keeps sibling", () => {
		const chunks = logprobChunksFromChoiceLogprobs({
			content: [
				{ token: "!", logprob: null },
				{ token: "ok", logprob: -0.2 },
			],
		});
		expect(chunks).toHaveLength(1);
		expect(chunks[0]).toMatchObject({ token: "ok" });
	});

	it("LSA-LP47: stream position starts at 0 and increments per token", () => {
		const state = createLogprobPositionState();
		expect(nextLogprobPosition(state, 0, "content")).toBe(0);
		expect(nextLogprobPosition(state, 0, "content")).toBe(1);
	});

	it("LSA-LP48: independent position counters per choiceIndex", () => {
		const state = createLogprobPositionState();
		expect(nextLogprobPosition(state, 0, "content")).toBe(0);
		expect(nextLogprobPosition(state, 1, "content")).toBe(0);
		expect(nextLogprobPosition(state, 0, "content")).toBe(1);
	});

	it("LSA-LP49: independent position counters per channel", () => {
		const state = createLogprobPositionState();
		expect(nextLogprobPosition(state, 0, "content")).toBe(0);
		expect(nextLogprobPosition(state, 0, "refusal")).toBe(0);
		expect(nextLogprobPosition(state, 0, "content")).toBe(1);
	});

	it("LSA-LP50: non-stream position equals array index within channel", () => {
		const chunks = logprobChunksFromChoiceLogprobs({
			content: [
				{ token: "a", logprob: -0.1 },
				{ token: "b", logprob: -0.2 },
			],
		});
		expect(chunks.map((chunk) => (chunk as { position?: number }).position)).toEqual([0, 1]);
	});

	it("LSA-LP51: empty-string token entry skipped", () => {
		const chunks = logprobChunksFromChoiceLogprobs({
			content: [
				{ token: "", logprob: -0.1 },
				{ token: "ok", logprob: -0.2 },
			],
		});
		expect(chunks).toHaveLength(1);
	});

	it("LSA-LP52: partial malformed top_logprobs still emits main token logprob", () => {
		const chunk = logprobEntryFromProvider(
			{
				token: "main",
				logprob: -0.05,
				top_logprobs: [null, { token: "main", logprob: -0.05 }],
			},
			"content",
		);
		expect(chunk).toMatchObject({ token: "main", logprob: -0.05 });
	});

	it("LSA-LP53: logprobs.content non-array ignored without throw", () => {
		expect(logprobChunksFromChoiceLogprobs({ content: "not-an-array" })).toEqual([]);
	});

	it("LSA-LP54: logprobs primitive value returns no chunks", () => {
		expect(logprobChunksFromChoiceLogprobs(42)).toEqual([]);
	});

	it("LSA-LP55: whitespace token preserved when non-empty", () => {
		const chunk = logprobEntryFromProvider({ token: " ", logprob: -0.01 }, "content");
		expect(chunk).toMatchObject({ token: " ", logprob: -0.01 });
	});

	it("LSA-LP56: positive infinity logprob entry skipped", () => {
		expect(
			logprobEntryFromProvider({ token: "x", logprob: Number.POSITIVE_INFINITY }, "content"),
		).toBeUndefined();
	});

	it("LSA-LP57: negative zero logprob accepted", () => {
		const chunk = logprobEntryFromProvider({ token: "z", logprob: -0 }, "content");
		expect((chunk as { logprob?: number }).logprob).toBe(-0);
	});

	it("LSA-LP58: empty top_logprobs array omits topLogprobs on chunk", () => {
		const chunk = logprobEntryFromProvider(
			{ token: "a", logprob: -0.1, top_logprobs: [] },
			"content",
		);
		expect(chunk).toMatchObject({ token: "a" });
		expect("topLogprobs" in (chunk ?? {})).toBe(false);
	});

	it("LSA-LP59: bytes array filters non-number entries", () => {
		const chunk = logprobEntryFromProvider(
			{ token: "x", logprob: -0.1, bytes: [72, "bad", 105] },
			"content",
		);
		expect(chunk).toMatchObject({ bytes: [72, 105] });
	});

	it("LSA-LP60: parser position state increments across sequential chunks", () => {
		const adapter = openaiChatAdapter();
		adapter.parseChunk(
			payload({
				choices: [
					{
						delta: { content: "a" },
						logprobs: { content: [{ token: "a", logprob: -0.1 }] },
					},
				],
			}),
		);
		const second = adapter.parseChunk(
			payload({
				choices: [
					{
						delta: { content: "b" },
						logprobs: { content: [{ token: "b", logprob: -0.2 }] },
					},
				],
			}),
		);
		const logprobs = second.filter((chunk) => chunk.kind === "logprob");
		expect((logprobs[0] as { position?: number }).position).toBe(1);
	});

	it("LSA-LP61: content and refusal arrays both emit in order", () => {
		const chunks = logprobChunksFromChoiceLogprobs({
			content: [{ token: "c", logprob: -0.1 }],
			refusal: [{ token: "r", logprob: -0.2 }],
		});
		expect(chunks.map((chunk) => (chunk as { channel?: string }).channel)).toEqual([
			"content",
			"refusal",
		]);
	});

	it("LSA-LP62: normalizeEvents strips default choiceIndex 0 from logprob", () => {
		const events = normalizeEvents([
			{
				type: "logprob",
				channel: "content",
				token: "a",
				logprob: -0.1,
				choiceIndex: 0,
			},
		]);
		expect(events[0]).toMatchObject({ type: "logprob", token: "a" });
		expect("choiceIndex" in (events[0] ?? {})).toBe(false);
	});

	it("LSA-LP63: SSE split mid-line still assembles logprobs-stream golden", async () => {
		const raw = readFileSync(join(openaiFixtures, "logprobs-stream.sse"), "utf8");
		const splitAt = Math.floor(raw.length / 2);
		const events = normalizeEvents(
			await collectAsync(
				assembleStream(
					byteStreamFromStrings(raw.slice(0, splitAt), raw.slice(splitAt)),
					openaiChatAdapter(),
				),
			),
		);
		expect(events).toEqual(expectedOpenAIEvents("logprobs-stream"));
	});

	it("LSA-LP64: mapStreamEventToAISDKPart maps logprob with topLogprobs", () => {
		const mapped = mapStreamEventToAISDKPart({
			type: "logprob",
			channel: "content",
			token: "Hi",
			logprob: -0.1,
			topLogprobs: [{ token: "Hi", logprob: -0.1 }],
		});
		expect(mapped).toEqual({
			type: "token-logprob",
			token: "Hi",
			logprob: -0.1,
			topLogprobs: [{ token: "Hi", logprob: -0.1 }],
		});
	});

	it("LSA-LP65: normalizeTopLogprobs returns undefined when all entries invalid", () => {
		expect(normalizeTopLogprobs([null, { bad: true }])).toBeUndefined();
	});

	it("LSA-LP66: xai preset forward-compat logprobs on content delta", () => {
		const chunks = openaiCompatibleAdapter({ provider: "xai" }).parseChunk(
			payload({
				choices: [
					{
						delta: { content: "x" },
						logprobs: { content: [{ token: "x", logprob: -0.1 }] },
					},
				],
			}),
		);
		expect(chunks.map((chunk) => chunk.kind)).toEqual(["logprob", "text-delta"]);
	});

	it("LSA-LP67: together preset forward-compat logprobs smoke", () => {
		const chunks = openaiCompatibleAdapter({ provider: "together" }).parseChunk(
			payload({
				choices: [
					{
						delta: { content: "y" },
						logprobs: { content: [{ token: "y", logprob: -0.2 }] },
					},
				],
			}),
		);
		expect(chunks.some((chunk) => chunk.kind === "logprob")).toBe(true);
	});

	it("LSA-LP68: ollama preset tolerates logprobs without throw", () => {
		expect(() =>
			openaiCompatibleAdapter({ provider: "ollama" }).parseChunk(
				payload({
					choices: [
						{
							delta: { content: "z" },
							logprobs: { content: [{ token: "z", logprob: -0.3 }] },
						},
					],
				}),
			),
		).not.toThrow();
	});

	it("LSA-LP69: fireworks preset logprob precedes text on same chunk", () => {
		const chunks = openaiCompatibleAdapter({ provider: "fireworks" }).parseChunk(
			payload({
				choices: [
					{
						delta: { content: "f" },
						logprobs: { content: [{ token: "f", logprob: -0.05 }] },
					},
				],
			}),
		);
		expect(chunks.map((chunk) => chunk.kind)).toEqual(["logprob", "text-delta"]);
	});

	it("LSA-LP70: perplexity preset logprobs coexist with root citations", () => {
		const chunks = openaiCompatibleAdapter({ provider: "perplexity" }).parseChunk(
			payload({
				citations: ["https://example.com"],
				choices: [
					{
						delta: { content: "p" },
						logprobs: { content: [{ token: "p", logprob: -0.1 }] },
					},
				],
			}),
		);
		expect(chunks.some((chunk) => chunk.kind === "citation")).toBe(true);
		expect(chunks.some((chunk) => chunk.kind === "logprob")).toBe(true);
		const logprobIndex = chunks.findIndex((chunk) => chunk.kind === "logprob");
		const textIndex = chunks.findIndex((chunk) => chunk.kind === "text-delta");
		expect(textIndex).toBeGreaterThan(logprobIndex);
	});

	it("LSA-LP71: missing logprobs key on chunk with delta emits no logprob", () => {
		const chunks = openaiChatAdapter().parseChunk(
			payload({
				choices: [{ delta: { content: "plain" } }],
			}),
		);
		expect(chunks.some((chunk) => chunk.kind === "logprob")).toBe(false);
	});

	it("LSA-LP72: three logprob entries precede single text delta on one chunk", () => {
		const chunks = openaiChatAdapter().parseChunk(
			payload({
				choices: [
					{
						delta: { content: "abc" },
						logprobs: {
							content: [
								{ token: "a", logprob: -0.1 },
								{ token: "b", logprob: -0.2 },
								{ token: "c", logprob: -0.3 },
							],
						},
					},
				],
			}),
		);
		expect(chunks.map((chunk) => chunk.kind)).toEqual([
			"logprob",
			"logprob",
			"logprob",
			"text-delta",
		]);
	});

	it("LSA-LP73: refusal logprob precedes refusal.delta on same chunk", () => {
		const chunks = openaiChatAdapter().parseChunk(
			payload({
				choices: [
					{
						delta: { refusal: "No" },
						logprobs: { refusal: [{ token: "No", logprob: -0.04 }] },
					},
				],
			}),
		);
		expect(chunks.map((chunk) => chunk.kind)).toEqual(["logprob", "refusal-delta"]);
	});

	it("LSA-LP74: usage and logprob on same chunk both emitted before finish", async () => {
		async function* payloads() {
			yield payload({
				choices: [
					{
						delta: { content: "u" },
						logprobs: { content: [{ token: "u", logprob: -0.1 }] },
						finish_reason: "stop",
					},
				],
				usage: { prompt_tokens: 2, completion_tokens: 1, total_tokens: 3 },
			});
		}
		const events = await collectAsync(assembleFromPayloads(payloads(), openaiChatAdapter()));
		expect(events.some((event) => event.type === "logprob")).toBe(true);
		expect(events.some((event) => event.type === "usage")).toBe(true);
		const finishIndex = events.findIndex((event) => event.type === "finish");
		expect(finishIndex).toBeGreaterThan(events.findIndex((event) => event.type === "logprob"));
		expect(finishIndex).toBeGreaterThan(events.findIndex((event) => event.type === "usage"));
	});

	it("LSA-LP75: cloudflare preset logprobs forward-compat smoke", () => {
		const chunks = openaiCompatibleAdapter({ provider: "cloudflare" }).parseChunk(
			payload({
				choices: [
					{
						delta: { content: "cf" },
						logprobs: { content: [{ token: "cf", logprob: -0.08 }] },
					},
				],
			}),
		);
		expect(chunks.some((chunk) => chunk.kind === "logprob")).toBe(true);
	});
});
