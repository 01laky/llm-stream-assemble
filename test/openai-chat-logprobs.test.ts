import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { openaiChatAdapter } from "../src/adapters/openai-chat";
import { openaiCompatibleAdapter } from "../src/adapters/openai-compatible";
import { EventAssembler } from "../src/core/assembler/event-assembler";
import { assembleFromPayloads } from "../src/core/assemble-payloads";
import { assembleResponse } from "../src/core/assemble-response";
import { assembleStream } from "../src/core/assemble-stream";
import { collectStream } from "../src/transforms/collect-stream";
import { runAdapterGoldenStream } from "./helpers/adapter-conformance";
import { byteStreamFromStrings, collectAsync } from "./helpers/collect-events";
import { hostCompatibleFixture } from "./helpers/compatible-fixtures";
import {
	expectedOpenAIEvents,
	normalizeEvents,
	normalizeRawChunks,
	openAIJSONFixture,
	openAITextFixture,
} from "./helpers/openai-fixtures";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const fixturesDir = join(rootDir, "test/fixtures/openai-chat");
const compatibleRoot = join(rootDir, "test/fixtures/openai-compatible");
const payload = (value: unknown) => JSON.stringify(value);

describe("openai chat logprobs", () => {
	it("LSA-OC296: parseChunk emits logprob RawChunk from logprobs.content", () => {
		const chunks = openaiChatAdapter().parseChunk(
			payload({
				choices: [
					{
						index: 0,
						delta: { content: "Hi" },
						logprobs: { content: [{ token: "Hi", logprob: -0.1 }] },
					},
				],
			}),
		);
		expect(chunks.some((chunk) => chunk.kind === "logprob")).toBe(true);
	});

	it("LSA-OC297: logprobs-stream golden includes logprob events", async () => {
		const events = normalizeEvents(
			await collectAsync(
				assembleStream(
					byteStreamFromStrings(openAITextFixture("logprobs-stream", "sse")),
					openaiChatAdapter(),
				),
			),
		);
		expect(events).toEqual(expectedOpenAIEvents("logprobs-stream"));
		expect(events.filter((event) => event.type === "logprob").length).toBeGreaterThan(0);
	});

	it("LSA-OC298: logprob events precede text.delta on same chunk", () => {
		const chunks = openaiChatAdapter().parseChunk(
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

	it("LSA-OC299: logprobs.refusal maps to channel refusal", async () => {
		const events = normalizeEvents(
			await collectAsync(
				assembleStream(
					byteStreamFromStrings(openAITextFixture("logprobs-refusal", "sse")),
					openaiChatAdapter(),
				),
			),
		);
		expect(
			events.filter((event) => event.type === "logprob").every((e) => e.channel === "refusal"),
		).toBe(true);
	});

	it("LSA-OC300: multichoice logprobs-stream preserves choiceIndex", async () => {
		const events = normalizeEvents(
			await collectAsync(
				assembleStream(
					byteStreamFromStrings(openAITextFixture("logprobs-multichoice", "sse")),
					openaiChatAdapter(),
				),
			),
		);
		expect(events).toEqual(expectedOpenAIEvents("logprobs-multichoice"));
	});

	it("LSA-OC301: logprobs null on tool-call delta emits no logprob chunk", () => {
		const chunks = openaiChatAdapter().parseChunk(
			payload({
				choices: [
					{
						delta: {
							tool_calls: [
								{
									index: 0,
									id: "call_x",
									function: { name: "fn", arguments: "{}" },
								},
							],
						},
						logprobs: null,
					},
				],
			}),
		);
		expect(chunks.some((chunk) => chunk.kind === "logprob")).toBe(false);
	});

	it("LSA-OC302: assembler drops post-finish logprob", () => {
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

	it("LSA-OC303: collectStream on logprobs-stream populates logprobs array", async () => {
		async function* stream() {
			for await (const event of assembleStream(
				byteStreamFromStrings(openAITextFixture("logprobs-stream", "sse")),
				openaiChatAdapter(),
			)) {
				yield event;
			}
		}
		const collected = await collectStream(stream());
		expect(collected.logprobs.length).toBeGreaterThan(0);
	});

	it("LSA-OC304: groq preset emits logprob events from host fixture", async () => {
		const events = normalizeEvents(
			await runAdapterGoldenStream({
				adapter: openaiCompatibleAdapter({ provider: "groq" }),
				fixtureSsePath: join(compatibleRoot, "groq/logprobs-stream.sse"),
				expectedEventsPath: join(compatibleRoot, "groq/logprobs-stream.expected.json"),
			}),
		);
		expect(events).toEqual(hostCompatibleFixture("groq", "logprobs-stream", "expected.json"));
	});

	it("LSA-OC305: azure preset no false logprob on metadata-only chunk", () => {
		const chunks = openaiCompatibleAdapter({ provider: "azure" }).parseChunk(
			payload({
				id: "chatcmpl_az",
				model: "gpt-4",
				choices: [{ index: 0, delta: { role: "assistant" }, logprobs: null }],
			}),
		);
		expect(chunks.some((chunk) => chunk.kind === "logprob")).toBe(false);
	});

	it("LSA-OC306: deepseek preset forward-compat logprobs smoke", () => {
		const chunks = openaiCompatibleAdapter({ provider: "deepseek" }).parseChunk(
			payload({
				choices: [
					{
						delta: { content: "x" },
						logprobs: { content: [{ token: "x", logprob: -0.1 }] },
					},
				],
			}),
		);
		expect(chunks.some((chunk) => chunk.kind === "logprob")).toBe(true);
	});

	it("LSA-OC307: mistral preset forward-compat logprobs smoke", () => {
		const chunks = openaiCompatibleAdapter({ provider: "mistral" }).parseChunk(
			payload({
				choices: [
					{
						delta: { content: "x" },
						logprobs: { content: [{ token: "x", logprob: -0.1 }] },
					},
				],
			}),
		);
		expect(chunks.some((chunk) => chunk.kind === "logprob")).toBe(true);
	});

	it("LSA-OC308: parseResponse logprobs-response emits logprob RawChunks", () => {
		const chunks = openaiChatAdapter().parseResponse!(openAIJSONFixture("logprobs-response"));
		expect(normalizeRawChunks(chunks).filter((chunk) => chunk.kind === "logprob").length).toBe(2);
	});

	it("LSA-OC309: assembleResponse yields typed logprob StreamEvents", () => {
		const events = assembleResponse(openAIJSONFixture("logprobs-response"), openaiChatAdapter());
		expect(events.filter((event) => event.type === "logprob")).toHaveLength(2);
	});

	it("LSA-OC310: non-stream logprob count matches content array length", () => {
		const body = openAIJSONFixture("logprobs-response") as {
			choices: Array<{ logprobs: { content: unknown[] } }>;
		};
		const events = assembleResponse(body, openaiChatAdapter());
		expect(events.filter((event) => event.type === "logprob")).toHaveLength(
			body.choices[0].logprobs.content.length,
		);
	});

	it("LSA-OC311: multichoice stream assembly preserves per-choice logprob indices", async () => {
		const events = normalizeEvents(
			await runAdapterGoldenStream({
				adapter: openaiChatAdapter(),
				fixtureSsePath: join(fixturesDir, "logprobs-multichoice.sse"),
				expectedEventsPath: join(fixturesDir, "logprobs-multichoice.expected.json"),
			}),
		);
		const logprobs = events.filter((event) => event.type === "logprob");
		expect(logprobs).toHaveLength(2);
		expect(logprobs[0]?.choiceIndex).toBeUndefined();
		expect(logprobs[1]?.choiceIndex).toBe(1);
	});

	it("LSA-OC312: jsonMode logprobs-json-mode golden parity", async () => {
		const events = normalizeEvents(
			await runAdapterGoldenStream({
				adapter: openaiChatAdapter({ jsonMode: true }),
				fixtureSsePath: join(fixturesDir, "logprobs-json-mode.sse"),
				expectedEventsPath: join(fixturesDir, "logprobs-json-mode.expected.json"),
			}),
		);
		expect(events).toEqual(expectedOpenAIEvents("logprobs-json-mode"));
	});

	it("LSA-OC313: reasoning_content and logprobs same chunk ordering", () => {
		const chunks = openaiChatAdapter().parseChunk(
			payload({
				choices: [
					{
						delta: {
							reasoning_content: "think",
							content: "out",
						},
						logprobs: { content: [{ token: "out", logprob: -0.1 }] },
					},
				],
			}),
		);
		expect(chunks.map((chunk) => chunk.kind)).toEqual(["logprob", "text-delta", "reasoning-delta"]);
	});

	it("LSA-OC314: usage and logprobs on final chunk both emitted pre-finish", async () => {
		async function* payloads() {
			yield payload({
				choices: [
					{
						delta: { content: "done" },
						logprobs: { content: [{ token: "done", logprob: -0.1 }] },
						finish_reason: "stop",
					},
				],
				usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
			});
		}
		const events = await collectAsync(assembleFromPayloads(payloads(), openaiChatAdapter()));
		expect(events.some((event) => event.type === "logprob")).toBe(true);
		expect(events.some((event) => event.type === "usage")).toBe(true);
		const finishIndex = events.findIndex((event) => event.type === "finish");
		const logprobIndex = events.findIndex((event) => event.type === "logprob");
		const usageIndex = events.findIndex((event) => event.type === "usage");
		expect(finishIndex).toBeGreaterThan(logprobIndex);
		expect(finishIndex).toBeGreaterThan(usageIndex);
	});

	it("LSA-OC315: text-basic stream unchanged when logprobs absent", async () => {
		const events = normalizeEvents(
			await collectAsync(
				assembleStream(
					byteStreamFromStrings(openAITextFixture("text-basic", "sse")),
					openaiChatAdapter(),
				),
			),
		);
		expect(events).toEqual(expectedOpenAIEvents("text-basic"));
		expect(events.some((event) => event.type === "logprob")).toBe(false);
	});

	it("LSA-OC316: logprobs-tool-stream golden matches expected", async () => {
		const events = normalizeEvents(
			await runAdapterGoldenStream({
				adapter: openaiChatAdapter(),
				fixtureSsePath: join(fixturesDir, "logprobs-tool-stream.sse"),
				expectedEventsPath: join(fixturesDir, "logprobs-tool-stream.expected.json"),
			}),
		);
		expect(events).toEqual(expectedOpenAIEvents("logprobs-tool-stream"));
	});

	it("LSA-OC317: groq host logprobs-stream golden", async () => {
		const events = normalizeEvents(
			await runAdapterGoldenStream({
				adapter: openaiCompatibleAdapter({ provider: "groq" }),
				fixtureSsePath: join(compatibleRoot, "groq/logprobs-stream.sse"),
				expectedEventsPath: join(compatibleRoot, "groq/logprobs-stream.expected.json"),
			}),
		);
		expect(events.some((event) => event.type === "logprob")).toBe(true);
	});

	it("LSA-OC318: logprobs-stream golden includes monotonic position on content", async () => {
		const events = normalizeEvents(
			await runAdapterGoldenStream({
				adapter: openaiChatAdapter(),
				fixtureSsePath: join(fixturesDir, "logprobs-stream.sse"),
				expectedEventsPath: join(fixturesDir, "logprobs-stream.expected.json"),
			}),
		);
		const contentLogprobs = events.filter(
			(event) => event.type === "logprob" && event.channel === "content",
		);
		expect(contentLogprobs.map((event) => event.position)).toEqual([0, 1]);
	});

	it("LSA-OC319: text-basic.sse golden unchanged without logprobs", async () => {
		const events = normalizeEvents(
			await runAdapterGoldenStream({
				adapter: openaiChatAdapter(),
				fixtureSsePath: join(fixturesDir, "text-basic.sse"),
				expectedEventsPath: join(fixturesDir, "text-basic.expected.json"),
			}),
		);
		expect(events.some((event) => event.type === "logprob")).toBe(false);
	});

	it("LSA-OC320: logprobs-stream golden unchanged after Responses shared-helper edit", async () => {
		const events = normalizeEvents(
			await runAdapterGoldenStream({
				adapter: openaiChatAdapter(),
				fixtureSsePath: join(fixturesDir, "logprobs-stream.sse"),
				expectedEventsPath: join(fixturesDir, "logprobs-stream.expected.json"),
			}),
		);
		expect(events).toEqual(expectedOpenAIEvents("logprobs-stream"));
	});
});
