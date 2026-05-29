import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
	createLogprobPositionState,
	logprobChunksFromResponsesLogprobs,
	logprobEntryFromProvider,
	nextLogprobPosition,
	normalizeTopLogprobs,
} from "../src/adapters/common/logprobs";
import { openaiResponsesAdapter } from "../src/adapters/openai-responses";
import { assembleFromFile } from "../src/core/assemble-from-file";
import { assembleFromPayloads } from "../src/core/assemble-payloads";
import { assembleResponse } from "../src/core/assemble-response";
import { assembleStream } from "../src/core/assemble-stream";
import { createAssemblyTransform } from "../src/core/create-assembly-transform";
import { EventAssembler } from "../src/core/assembler/event-assembler";
import { logprobConfidence } from "../src/helpers/logprob-confidence";
import { alignLogprobsWithText } from "../src/helpers/align-logprobs-with-text";
import { isLogprob } from "../src/helpers/type-guards";
import { mapStreamEventToAISDKPart } from "../examples/integrations/stream-event-to-ai-sdk-parts";
import { collectStream } from "../src/transforms/collect-stream";
import { tapEvents } from "../src/transforms/tap-events";
import { toSSE } from "../src/transforms/to-sse";
import { byteStreamFromStrings, collectAsync, strings } from "./helpers/collect-events";
import {
	expectedResponsesEvents,
	normalizeResponsesEvents,
	normalizeResponsesRawChunks,
	responsesJSONFixture,
	responsesTextFixture,
} from "./helpers/responses-fixtures";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const fixturesDir = join(rootDir, "test/fixtures/openai-responses");
const payload = (value: unknown) => JSON.stringify(value);

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

describe("responses logprobs extended edge", () => {
	it("LSA-RL26: malformed logprob entry skipped; sibling kept", () => {
		const chunks = logprobChunksFromResponsesLogprobs(
			[{ bad: true }, { token: "ok", logprob: -0.2 }],
			"content",
		);
		expect(chunks).toHaveLength(1);
		expect(chunks[0]).toMatchObject({ token: "ok" });
	});

	it("LSA-RL27: null logprob on entry skipped", () => {
		expect(logprobEntryFromProvider({ token: "a", logprob: null }, "content")).toBeUndefined();
	});

	it("LSA-RL28: unicode token preserved", async () => {
		const events = await collectAsync(
			assembleStream(
				byteStreamFromStrings(
					[
						'data: {"type":"response.output_text.delta","delta":"é","logprobs":[{"token":"é","logprob":-0.1}]}\n\n',
						'data: {"type":"response.completed","response":{"status":"completed"}}\n\n',
					].join(""),
				),
				openaiResponsesAdapter(),
			),
		);
		const logprob = events.find((event) => event.type === "logprob");
		expect((logprob as { token?: string })?.token).toBe("é");
	});

	it("LSA-RL29: SSE split mid-line still assembles logprobs golden", async () => {
		const sse = readFileSync(join(fixturesDir, "logprobs-stream.sse"), "utf8");
		const splitAt = Math.floor(sse.length / 2);
		const events = normalizeResponsesEvents(
			await collectAsync(
				assembleStream(
					byteStreamFromStrings(sse.slice(0, splitAt), sse.slice(splitAt)),
					openaiResponsesAdapter(),
				),
			),
		);
		expect(events.filter((event) => (event as { type?: string }).type === "logprob")).toHaveLength(
			2,
		);
	});

	it("LSA-RL30: tapEvents forwards logprob unchanged", async () => {
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

	it("LSA-RL31: logprobConfidence on assembled Responses logprob", async () => {
		const events = await streamFixture("logprobs-stream");
		const logprob = events.find((event) => (event as { type?: string }).type === "logprob") as {
			logprob: number;
		};
		expect(logprobConfidence(logprob).probability).toBeGreaterThan(0);
	});

	it("LSA-RL32: alignLogprobsWithText E2E on logprobs-stream", async () => {
		const collected = await collectStream(
			assembleStream(
				byteStreamFromStrings(responsesTextFixture("logprobs-stream", "sse")),
				openaiResponsesAdapter(),
			),
		);
		const result = alignLogprobsWithText({
			assistantText: collected.text,
			logprobs: collected.logprobs.map((event) => ({
				token: event.token,
				logprob: event.logprob,
				position: event.position,
			})),
		});
		expect(result.entries.length).toBe(2);
	});

	it("LSA-RL33: function-call stream has no logprob on tool events", async () => {
		const events = await streamFixture("logprobs-tool-stream");
		const toolTypes = new Set(["tool_call.start", "tool_call.args.delta", "tool_call.done"]);
		const toolAdjacent = events.filter((event) => toolTypes.has((event as { type?: string }).type));
		expect(toolAdjacent.length).toBeGreaterThan(0);
		expect(events.some((event) => (event as { type?: string }).type === "logprob")).toBe(true);
	});

	it("LSA-RL34: parallel function calls and text logprobs ordering", async () => {
		const events = await streamFixture("logprobs-tool-stream");
		const logprobIndex = events.findIndex(
			(event) => (event as { type?: string }).type === "logprob",
		);
		const toolIndex = events.findIndex(
			(event) => (event as { type?: string }).type === "tool_call.start",
		);
		expect(logprobIndex).toBeLessThan(toolIndex);
	});

	it("LSA-RL35: response.completed finish ordering after logprob deltas", async () => {
		const events = await streamFixture("logprobs-stream");
		const lastLogprob = events
			.map((event) => (event as { type?: string }).type)
			.lastIndexOf("logprob");
		const finish = events.findIndex((event) => (event as { type?: string }).type === "finish");
		expect(lastLogprob).toBeLessThan(finish);
	});

	it("LSA-RL36: response.incomplete with logprobs pre-terminal", async () => {
		const events = normalizeResponsesEvents(
			await collectAsync(
				assembleStream(
					byteStreamFromStrings(
						[
							'data: {"type":"response.output_text.delta","delta":"x","logprobs":[{"token":"x","logprob":-0.1}]}\n\n',
							'data: {"type":"response.incomplete","response":{"status":"incomplete","usage":{"input_tokens":1,"output_tokens":1}}}\n\n',
						].join(""),
					),
					openaiResponsesAdapter(),
				),
			),
		);
		expect(events.some((event) => (event as { type?: string }).type === "logprob")).toBe(true);
		expect(events.at(-1)).toEqual({ type: "finish", reason: "incomplete" });
	});

	it("LSA-RL37: response.failed emits no logprob after error terminal", async () => {
		const events = await streamFixture("logprobs-failed-stream");
		const errorIndex = events.findIndex((event) => (event as { type?: string }).type === "error");
		expect(errorIndex).toBeGreaterThan(0);
		expect(
			events
				.slice(errorIndex + 1)
				.every((event) => (event as { type?: string }).type !== "logprob"),
		).toBe(true);
	});

	it("LSA-RL38: unknown event type with stray logprobs field ignored", () => {
		const chunks = openaiResponsesAdapter().parseChunk(
			payload({ type: "response.custom.event", logprobs: [{ token: "x", logprob: -0.1 }] }),
		);
		expect(chunks.every((chunk) => chunk.kind !== "logprob")).toBe(true);
	});

	it("LSA-RL39: content_part.added emits logprobs before text", () => {
		const chunks = openaiResponsesAdapter().parseChunk(
			payload({
				type: "response.content_part.added",
				part: { type: "output_text", text: "Hi", logprobs: [{ token: "Hi", logprob: -0.08 }] },
			}),
		);
		expect(chunks.map((chunk) => chunk.kind)).toEqual(["logprob", "text-delta"]);
	});

	it("LSA-RL40: duplicate output_text.done after finish emits no extra logprobs", async () => {
		const events = normalizeResponsesEvents(
			await collectAsync(
				assembleFromPayloads(
					strings(
						payload({
							type: "response.output_text.delta",
							delta: "a",
							logprobs: [{ token: "a", logprob: -0.1 }],
						}),
						payload({ type: "response.completed", response: { status: "completed" } }),
						payload({
							type: "response.output_text.done",
							text: "a",
							logprobs: [{ token: "a", logprob: -0.1 }],
						}),
					),
					openaiResponsesAdapter(),
				),
			),
		);
		expect(events.filter((event) => (event as { type?: string }).type === "logprob")).toHaveLength(
			1,
		);
	});

	it("LSA-RL41: very negative logprob preserved", () => {
		const chunk = logprobEntryFromProvider({ token: "x", logprob: -50 }, "content");
		expect((chunk as { logprob?: number }).logprob).toBe(-50);
	});

	it("LSA-RL42: empty-string token skipped", () => {
		expect(logprobEntryFromProvider({ token: "", logprob: -0.1 }, "content")).toBeUndefined();
	});

	it("LSA-RL43: normalizeResponsesEvents strips logprob raw", async () => {
		const events = await collectAsync(
			assembleStream(
				byteStreamFromStrings(responsesTextFixture("logprobs-stream", "sse")),
				openaiResponsesAdapter(),
			),
		);
		const normalized = normalizeResponsesEvents(events);
		expect(normalized.every((event) => !("raw" in (event as object)))).toBe(true);
	});

	it("LSA-RL44: assembleFromFile logprobs-stream replay", async () => {
		const events = normalizeResponsesEvents(
			await collectAsync(
				assembleFromFile(join(fixturesDir, "logprobs-stream.sse"), openaiResponsesAdapter()),
			),
		);
		expect(events).toEqual(expectedResponsesEvents("logprobs-stream"));
	});

	it("LSA-RL45: mapStreamEventToAISDKPart maps content logprob to token-logprob", async () => {
		const events = await streamFixture("logprobs-stream");
		const logprob = events.find((event) => (event as { type?: string }).type === "logprob");
		expect(mapStreamEventToAISDKPart(logprob as never)).toMatchObject({ type: "token-logprob" });
	});

	it("LSA-RL46: multi-output stream sets choiceIndex on non-zero output_index", async () => {
		const events = await streamFixture("logprobs-multi-output");
		expect(events).toEqual(expectedResponsesEvents("logprobs-multi-output"));
	});

	it("LSA-RL47: fresh adapter instance allows done-only logprobs path", async () => {
		const events = await streamFixture("logprobs-done-batch");
		expect(events.filter((event) => (event as { type?: string }).type === "logprob").length).toBe(
			2,
		);
	});

	it("LSA-RL48: non-stream refusal content part logprobs", () => {
		const events = normalizeResponsesEvents(
			assembleResponse(responsesJSONFixture("logprobs-refusal-response"), openaiResponsesAdapter()),
		);
		expect(events).toEqual(expectedResponsesEvents("logprobs-refusal-response"));
	});

	it("LSA-RL49: mapStreamEventToAISDKPart maps refusal channel logprob", () => {
		const mapped = mapStreamEventToAISDKPart({
			type: "logprob",
			channel: "refusal",
			token: "No",
			logprob: -0.2,
		});
		expect(mapped).toMatchObject({ type: "token-logprob", token: "No" });
	});

	it("LSA-RL50: large top_logprobs array normalized without truncation", () => {
		const top = Array.from({ length: 20 }, (_, index) => ({
			token: `t${index}`,
			logprob: -index * 0.1,
		}));
		const chunks = openaiResponsesAdapter().parseChunk(
			payload({
				type: "response.output_text.delta",
				delta: "x",
				logprobs: [{ token: "x", logprob: -0.1, top_logprobs: top }],
			}),
		);
		expect((chunks[0] as { topLogprobs?: unknown[] }).topLogprobs).toHaveLength(20);
		expect(logprobConfidence({ logprob: -0.1 }).probability).toBeGreaterThan(0);
	});

	it("LSA-RL51: failed stream fixture locks partial logprobs before terminal", async () => {
		const events = await streamFixture("logprobs-failed-stream");
		expect(events).toEqual(expectedResponsesEvents("logprobs-failed-stream"));
	});

	it("LSA-RL52: content_part.added golden E2E", async () => {
		const events = await streamFixture("logprobs-content-part-added");
		expect(events).toEqual(expectedResponsesEvents("logprobs-content-part-added"));
	});

	it("LSA-RL43b: normalizeResponsesRawChunks strips logprob raw", () => {
		const chunks = openaiResponsesAdapter().parseChunk(
			payload({
				type: "response.output_text.delta",
				delta: "a",
				logprobs: [{ token: "a", logprob: -0.1 }],
			}),
		);
		const normalized = normalizeResponsesRawChunks(chunks);
		expect(normalized.every((chunk) => !("raw" in (chunk as object)))).toBe(true);
	});

	it("LSA-RL53: logprobs without text delta emit logprob only", () => {
		const chunks = openaiResponsesAdapter().parseChunk(
			payload({
				type: "response.output_text.delta",
				logprobs: [{ token: "only", logprob: -0.1 }],
			}),
		);
		expect(chunks.map((chunk) => chunk.kind)).toEqual(["logprob"]);
	});

	it("LSA-RL54: logprobChunksFromResponsesLogprobs non-array returns empty", () => {
		expect(logprobChunksFromResponsesLogprobs("not-array", "content")).toEqual([]);
		expect(logprobChunksFromResponsesLogprobs(42, "content")).toEqual([]);
		expect(logprobChunksFromResponsesLogprobs(null, "content")).toEqual([]);
	});

	it("LSA-RL55: parser position increments across sequential text deltas", () => {
		const adapter = openaiResponsesAdapter();
		adapter.parseChunk(
			payload({
				type: "response.output_text.delta",
				delta: "a",
				logprobs: [{ token: "a", logprob: -0.1 }],
			}),
		);
		const second = adapter.parseChunk(
			payload({
				type: "response.output_text.delta",
				delta: "b",
				logprobs: [{ token: "b", logprob: -0.2 }],
			}),
		);
		const logprob = second.find((chunk) => chunk.kind === "logprob");
		expect((logprob as { position?: number }).position).toBe(1);
	});

	it("LSA-RL56: independent position counters per output_index", () => {
		const adapter = openaiResponsesAdapter();
		adapter.parseChunk(
			payload({
				type: "response.output_text.delta",
				output_index: 0,
				delta: "a",
				logprobs: [{ token: "a", logprob: -0.1 }],
			}),
		);
		const second = adapter.parseChunk(
			payload({
				type: "response.output_text.delta",
				output_index: 1,
				delta: "b",
				logprobs: [{ token: "b", logprob: -0.2 }],
			}),
		);
		const logprob = second.find((chunk) => chunk.kind === "logprob");
		expect((logprob as { position?: number }).position).toBe(0);
		expect((logprob as { choiceIndex?: number }).choiceIndex).toBe(1);
	});

	it("LSA-RL57: independent position counters per channel on refusal vs content", () => {
		const adapter = openaiResponsesAdapter();
		adapter.parseChunk(
			payload({
				type: "response.output_text.delta",
				delta: "x",
				logprobs: [{ token: "x", logprob: -0.1 }],
			}),
		);
		const refusal = adapter.parseChunk(
			payload({
				type: "response.refusal.delta",
				delta: "n",
				logprobs: [{ token: "n", logprob: -0.2 }],
			}),
		);
		const logprob = refusal.find((chunk) => chunk.kind === "logprob");
		expect((logprob as { channel?: string }).channel).toBe("refusal");
		expect((logprob as { position?: number }).position).toBe(0);
	});

	it("LSA-RL58: whitespace token preserved when non-empty", () => {
		const chunk = logprobEntryFromProvider({ token: " ", logprob: -0.01 }, "content");
		expect(chunk).toMatchObject({ token: " ", logprob: -0.01 });
	});

	it("LSA-RL59: positive infinity logprob entry skipped", () => {
		expect(
			logprobEntryFromProvider({ token: "x", logprob: Number.POSITIVE_INFINITY }, "content"),
		).toBeUndefined();
	});

	it("LSA-RL60: negative zero logprob accepted", () => {
		const chunk = logprobEntryFromProvider({ token: "z", logprob: -0 }, "content");
		expect((chunk as { logprob?: number }).logprob).toBe(-0);
	});

	it("LSA-RL61: empty top_logprobs array omits topLogprobs on chunk", () => {
		const chunk = logprobEntryFromProvider(
			{ token: "a", logprob: -0.1, top_logprobs: [] },
			"content",
		);
		expect(chunk).toMatchObject({ token: "a" });
		expect("topLogprobs" in (chunk ?? {})).toBe(false);
	});

	it("LSA-RL62: bytes array filters non-number entries", () => {
		const chunk = logprobEntryFromProvider(
			{ token: "x", logprob: -0.1, bytes: [72, "bad", 105] },
			"content",
		);
		expect(chunk).toMatchObject({ bytes: [72, 105] });
	});

	it("LSA-RL63: partial malformed top_logprobs still emits main token logprob", () => {
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

	it("LSA-RL64: normalizeTopLogprobs returns undefined when all entries invalid", () => {
		expect(normalizeTopLogprobs([null, { bad: true }])).toBeUndefined();
	});

	it("LSA-RL65: three logprob entries precede single text delta on one chunk", () => {
		const chunks = openaiResponsesAdapter().parseChunk(
			payload({
				type: "response.output_text.delta",
				delta: "abc",
				logprobs: [
					{ token: "a", logprob: -0.1 },
					{ token: "b", logprob: -0.2 },
					{ token: "c", logprob: -0.3 },
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

	it("LSA-RL66: refusal logprob precedes refusal.delta on same chunk", () => {
		const chunks = openaiResponsesAdapter().parseChunk(
			payload({
				type: "response.refusal.delta",
				delta: "No",
				logprobs: [{ token: "No", logprob: -0.04 }],
			}),
		);
		expect(chunks.map((chunk) => chunk.kind)).toEqual(["logprob", "refusal-delta"]);
	});

	it("LSA-RL67: usage and logprob ordering before finish on completed stream", async () => {
		const events = await streamFixture("logprobs-stream");
		const logprobIndex = events.findIndex((event) => event.type === "logprob");
		const usageIndex = events.findIndex((event) => event.type === "usage");
		const finishIndex = events.findIndex((event) => event.type === "finish");
		expect(logprobIndex).toBeGreaterThanOrEqual(0);
		expect(usageIndex).toBeGreaterThan(logprobIndex);
		expect(finishIndex).toBeGreaterThan(usageIndex);
	});

	it("LSA-RL68: SSE split mid-line assembles full logprobs-stream golden", async () => {
		const raw = readFileSync(join(fixturesDir, "logprobs-stream.sse"), "utf8");
		const splitAt = Math.floor(raw.length / 2);
		const events = normalizeResponsesEvents(
			await collectAsync(
				assembleStream(
					byteStreamFromStrings(raw.slice(0, splitAt), raw.slice(splitAt)),
					openaiResponsesAdapter(),
				),
			),
		);
		expect(events).toEqual(expectedResponsesEvents("logprobs-stream"));
	});

	it("LSA-RL69: normalizeResponsesEvents strips default choiceIndex 0 from logprob", () => {
		const events = normalizeResponsesEvents([
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

	it("LSA-RL70: mapStreamEventToAISDKPart maps logprob with topLogprobs", () => {
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

	it("LSA-RL71: strictToolArgs unaffected when Responses logprob events present", async () => {
		const events = await collectAsync(
			assembleFromFile(join(fixturesDir, "logprobs-tool-stream.sse"), openaiResponsesAdapter(), {
				strictToolArgs: true,
			}),
		);
		expect(events.some((event) => event.type === "logprob")).toBe(true);
		expect(events.some((event) => event.type === "tool_call.done")).toBe(true);
	});

	it("LSA-RL72: post-finish logprob dropped through tapEvents pipeline", async () => {
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

	it("LSA-RL73: content_part.done with logprobs on part emits before text", () => {
		const chunks = openaiResponsesAdapter().parseChunk(
			payload({
				type: "response.content_part.done",
				part: {
					type: "output_text",
					text: "Done",
					logprobs: [{ token: "Done", logprob: -0.07 }],
				},
			}),
		);
		expect(chunks.map((chunk) => chunk.kind)).toEqual(["logprob", "text-delta"]);
	});

	it("LSA-RL74: function_call output_item ignores stray logprobs field", () => {
		const chunks = openaiResponsesAdapter().parseChunk(
			payload({
				type: "response.output_item.added",
				item: {
					type: "function_call",
					id: "fc_x",
					call_id: "call_x",
					name: "fn",
					logprobs: [{ token: "bad", logprob: -0.1 }],
				},
			}),
		);
		expect(chunks.every((chunk) => chunk.kind !== "logprob")).toBe(true);
	});

	it("LSA-RL75: logprobs null on delta treated as absent", () => {
		const chunks = openaiResponsesAdapter().parseChunk(
			payload({
				type: "response.output_text.delta",
				delta: "plain",
				logprobs: null,
			}),
		);
		expect(chunks.some((chunk) => chunk.kind === "logprob")).toBe(false);
		expect(chunks.some((chunk) => chunk.kind === "text-delta")).toBe(true);
	});

	it("LSA-RL76: NaN logprob on entry skipped", () => {
		expect(
			logprobEntryFromProvider({ token: "a", logprob: Number.NaN }, "content"),
		).toBeUndefined();
	});

	it("LSA-RL77: jsonMode delta with logprobs only and no text key", () => {
		const chunks = openaiResponsesAdapter({ jsonMode: true }).parseChunk(
			payload({
				type: "response.output_text.delta",
				logprobs: [{ token: "{", logprob: -0.2 }],
			}),
		);
		expect(chunks.map((chunk) => chunk.kind)).toEqual(["logprob"]);
	});

	it("LSA-RL78: output_item.added message item with output_text logprobs", () => {
		const chunks = openaiResponsesAdapter().parseChunk(
			payload({
				type: "response.output_item.added",
				item: {
					type: "message",
					content: [
						{
							type: "output_text",
							text: "Hi",
							logprobs: [{ token: "Hi", logprob: -0.09 }],
						},
					],
				},
			}),
		);
		expect(chunks.map((chunk) => chunk.kind)).toEqual(["logprob", "text-delta"]);
	});

	it("LSA-RL79: nextLogprobPosition helper increments per key", () => {
		const state = createLogprobPositionState();
		expect(nextLogprobPosition(state, undefined, "content")).toBe(0);
		expect(nextLogprobPosition(state, undefined, "content")).toBe(1);
		expect(nextLogprobPosition(state, 1, "content")).toBe(0);
	});

	it("LSA-RL80: logprobConfidence with topLogprobs margin on Responses event", async () => {
		const events = await streamFixture("logprobs-stream");
		const first = events.find((event) => event.type === "logprob");
		expect(first).toBeDefined();
		if (!first || first.type !== "logprob") return;
		expect(first.topLogprobs?.length).toBeGreaterThanOrEqual(2);
		const confidence = logprobConfidence({
			logprob: first.logprob,
			topLogprobs: first.topLogprobs,
		});
		expect(confidence.probability).toBeDefined();
		expect(confidence.margin).toBeDefined();
		expect(confidence.runnerUpToken).toBeDefined();
	});

	it("LSA-RL81: toSSE round-trip preserves Responses logprob type", async () => {
		const output = await readStream(
			toSSE(
				(async function* () {
					yield {
						type: "logprob" as const,
						channel: "content" as const,
						token: "Hi",
						logprob: -0.12,
						position: 0,
					};
				})(),
			),
		);
		expect(output).toContain('"type":"logprob"');
		expect(output).toContain('"channel":"content"');
	});

	it("LSA-RL82: transform pipeline preserves logprob-before-text order", async () => {
		const sse = readFileSync(join(fixturesDir, "logprobs-stream.sse"), "utf8");
		const transform = createAssemblyTransform(openaiResponsesAdapter());
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

	it("LSA-RL83: assembleFromPayloads post-finish logprob dropped", async () => {
		const events = await collectAsync(
			assembleFromPayloads(
				strings(
					payload({ type: "response.completed", response: { status: "completed" } }),
					payload({
						type: "response.output_text.delta",
						delta: "late",
						logprobs: [{ token: "late", logprob: -0.1 }],
					}),
				),
				openaiResponsesAdapter(),
			),
		);
		expect(events.some((event) => event.type === "logprob")).toBe(false);
	});

	it("LSA-RL84: done-batch emits multiple logprob positions 0..n-1", async () => {
		const events = await streamFixture("logprobs-done-batch");
		const positions = events
			.filter((event) => event.type === "logprob")
			.map((event) => (event as { position?: number }).position);
		expect(positions).toEqual([0, 1]);
	});

	it("LSA-RL85: refusal stream golden interleaves refusal channel logprobs", async () => {
		const events = await streamFixture("logprobs-refusal");
		const channels = events
			.filter((event) => event.type === "logprob")
			.map((event) => (event as { channel?: string }).channel);
		expect(channels).toEqual(["refusal", "refusal"]);
	});

	it("LSA-RL86: json-mode stream golden keeps logprob before json.delta", async () => {
		const events = await streamFixture("logprobs-json-mode", { jsonMode: true });
		expect(events).toEqual(expectedResponsesEvents("logprobs-json-mode"));
		const types = events.map((event) => event.type);
		for (let index = 0; index < types.length; index += 1) {
			if (types[index] !== "json.delta") continue;
			const priorLogprob = types.slice(0, index).lastIndexOf("logprob");
			expect(priorLogprob).toBeGreaterThanOrEqual(0);
		}
	});

	it("LSA-RL87: multi-output golden preserves choiceIndex 1 only on second output", async () => {
		const events = await streamFixture("logprobs-multi-output");
		const logprobs = events.filter((event) => event.type === "logprob");
		expect(logprobs).toHaveLength(2);
		expect(logprobs[0]?.choiceIndex).toBeUndefined();
		expect(logprobs[1]?.choiceIndex).toBe(1);
	});

	it("LSA-RL88: collectStream isLogprob filter on Responses assembly", async () => {
		const events = await collectAsync(
			assembleStream(
				byteStreamFromStrings(responsesTextFixture("logprobs-stream", "sse")),
				openaiResponsesAdapter(),
			),
		);
		expect(events.filter(isLogprob)).toHaveLength(2);
	});

	it("LSA-RL89: non-stream mixed output_text and refusal logprobs ordering", () => {
		const events = normalizeResponsesEvents(
			assembleResponse(
				{
					output: [
						{
							type: "message",
							content: [
								{
									type: "output_text",
									text: "ok",
									logprobs: [{ token: "ok", logprob: -0.1 }],
								},
								{
									type: "refusal",
									refusal: "no",
									logprobs: [{ token: "no", logprob: -0.2 }],
								},
							],
						},
					],
					status: "completed",
				},
				openaiResponsesAdapter(),
			),
		);
		const kinds = events.map((event) => event.type);
		const textLogprob = kinds.indexOf("logprob");
		const textDone = kinds.indexOf("text.done");
		const refusalLogprob = kinds.indexOf("logprob", textLogprob + 1);
		const refusalDone = kinds.indexOf("refusal.done");
		expect(textLogprob).toBeLessThan(textDone);
		expect(refusalLogprob).toBeLessThan(refusalDone);
	});

	it("LSA-RL90: empty delta and empty logprobs array emit nothing", () => {
		const chunks = openaiResponsesAdapter().parseChunk(
			payload({
				type: "response.output_text.delta",
				delta: "",
				logprobs: [],
			}),
		);
		expect(chunks).toEqual([]);
	});
});
