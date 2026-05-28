import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { anthropicAdapter } from "../src/adapters/anthropic";
import { bedrockAdapter } from "../src/adapters/bedrock";
import { cohereAdapter } from "../src/adapters/cohere";
import { geminiAdapter } from "../src/adapters/gemini";
import { openaiChatAdapter } from "../src/adapters/openai-chat";
import { openaiCompatibleAdapter } from "../src/adapters/openai-compatible";
import { openaiResponsesAdapter } from "../src/adapters/openai-responses";
import type { StreamAdapter, StreamEvent } from "../src/core/types";
import { assembleFromPayloads } from "../src/core/assemble-payloads";
import { assembleStream } from "../src/core/assemble-stream";
import { byteStreamFromSplitString, jsonlLinesFromByteStream } from "./helpers/byte-stream";
import { collectAsync } from "./helpers/collect-events";
import { createAdapterForEntry, discoverStreamFixtures } from "./helpers/fixture-catalog";
import { runGoldenStreamParity } from "./helpers/golden-parity";
import { assertStreamInvariants, profileForAdapterKey } from "./helpers/stream-invariants";

const payload = (value: unknown) => JSON.stringify(value);

async function eventsFromFixture(id: string): Promise<StreamEvent[]> {
	const entry = discoverStreamFixtures().find((row) => row.id === id);
	if (!entry) throw new Error(`Missing fixture ${id}`);
	const raw = readFileSync(entry.streamPath, "utf8");
	const adapter = createAdapterForEntry(entry);
	const stream = byteStreamFromSplitString(raw, 0);
	if (entry.transport === "sse") {
		return collectAsync(assembleStream(stream, adapter));
	}
	return collectAsync(assembleFromPayloads(jsonlLinesFromByteStream(stream), adapter));
}

async function eventsFromPayloads(adapter: StreamAdapter, lines: string[]): Promise<StreamEvent[]> {
	async function* payloads() {
		for (const line of lines) yield line;
	}
	return collectAsync(assembleFromPayloads(payloads(), adapter));
}

type ContractRow = {
	id: string;
	adapterKey: string;
	run: () => Promise<StreamEvent[]>;
};

const FIXTURE_CONTRACT_IDS = [
	"openai-chat/text-basic.sse",
	"openai-chat/tool-parallel.sse",
	"openai-chat/json-mode.sse",
	"openai-responses/text-basic.sse",
	"openai-responses/json-mode.sse",
	"anthropic/text-basic.sse",
	"anthropic/tool-parallel.sse",
	"anthropic/json-mode.sse",
	"anthropic/incomplete.sse",
	"gemini/text-basic.sse",
	"gemini/tool-parallel.sse",
	"gemini/grounding-metadata.sse",
	"gemini/vertex/text-basic.jsonl",
	"cohere/text-basic.jsonl",
	"cohere/tool-parallel.jsonl",
	"bedrock/text-basic.jsonl",
	"openai-compatible/generic-text.sse",
	"openai-compatible/groq/text-basic.sse",
	"openai-compatible/perplexity/text-basic.sse",
	"openai-compatible/azure/content-filter-block.sse",
] as const;

const fixtureRows: ContractRow[] = FIXTURE_CONTRACT_IDS.map((fixtureId, index) => ({
	id: `LSA-X${141 + index}`,
	adapterKey: discoverStreamFixtures().find((row) => row.id === fixtureId)?.adapterKey ?? "unknown",
	run: () => eventsFromFixture(fixtureId),
}));

const syntheticRows: ContractRow[] = [
	{
		id: "LSA-X161",
		adapterKey: "openai-chat",
		run: () =>
			eventsFromPayloads(openaiChatAdapter(), [
				payload({ choices: [{ index: 0, delta: { content: "a" } }] }),
				payload({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] }),
			]),
	},
	{
		id: "LSA-X162",
		adapterKey: "openai-responses",
		run: () =>
			eventsFromPayloads(openaiResponsesAdapter(), [
				payload({ type: "response.output_text.delta", delta: "a" }),
				payload({ type: "response.completed", response: {} }),
			]),
	},
	{
		id: "LSA-X163",
		adapterKey: "anthropic",
		run: () =>
			eventsFromPayloads(anthropicAdapter(), [
				payload({
					type: "content_block_delta",
					index: 0,
					delta: { type: "text_delta", text: "a" },
				}),
				payload({ type: "message_delta", delta: { stop_reason: "end_turn" } }),
				payload({ type: "message_stop" }),
			]),
	},
	{
		id: "LSA-X164",
		adapterKey: "gemini",
		run: () =>
			eventsFromPayloads(geminiAdapter(), [
				payload({ candidates: [{ index: 0, content: { parts: [{ text: "a" }] } }] }),
				payload({ candidates: [{ index: 0, finishReason: "STOP", content: { parts: [] } }] }),
			]),
	},
	{
		id: "LSA-X165",
		adapterKey: "cohere",
		run: () =>
			eventsFromPayloads(cohereAdapter(), [
				payload({ type: "message-start", id: "m", delta: { message: { role: "assistant" } } }),
				payload({
					type: "content-delta",
					index: 0,
					delta: { message: { content: { text: "a" } } },
				}),
				payload({ type: "message-end", delta: { finish_reason: "COMPLETE" } }),
			]),
	},
	{
		id: "LSA-X166",
		adapterKey: "bedrock",
		run: () =>
			eventsFromPayloads(bedrockAdapter(), [
				payload({ messageStart: { role: "assistant" } }),
				payload({ contentBlockDelta: { contentBlockIndex: 0, delta: { text: "a" } } }),
				payload({ messageStop: { stopReason: "end_turn" } }),
			]),
	},
	{
		id: "LSA-X167",
		adapterKey: "openai-compatible",
		run: () =>
			eventsFromPayloads(openaiCompatibleAdapter(), [
				payload({ choices: [{ delta: { content: "a" }, finish_reason: "stop" }] }),
			]),
	},
	{
		id: "LSA-X168",
		adapterKey: "openai-chat",
		run: () =>
			eventsFromPayloads(openaiChatAdapter(), [
				payload({
					choices: [
						{
							index: 0,
							delta: {
								tool_calls: [{ index: 0, id: "c1", function: { name: "fn", arguments: "{}" } }],
							},
							finish_reason: "tool_calls",
						},
					],
				}),
			]),
	},
	{
		id: "LSA-X169",
		adapterKey: "anthropic",
		run: () =>
			eventsFromPayloads(anthropicAdapter(), [
				payload({
					type: "content_block_start",
					index: 0,
					content_block: { type: "tool_use", id: "t1", name: "fn", input: {} },
				}),
				payload({
					type: "content_block_delta",
					index: 0,
					delta: { type: "input_json_delta", partial_json: "{}" },
				}),
				payload({ type: "message_delta", delta: { stop_reason: "tool_use" } }),
			]),
	},
	{
		id: "LSA-X170",
		adapterKey: "openai-responses",
		run: () =>
			eventsFromPayloads(openaiResponsesAdapter(), [
				payload({ type: "response.incomplete", response: { id: "r1", status: "incomplete" } }),
			]),
	},
	{
		id: "LSA-X171",
		adapterKey: "gemini-vertex",
		run: () =>
			eventsFromPayloads(geminiAdapter({ apiSurface: "vertex" }), [
				payload({
					responseId: "v1",
					candidates: [{ index: 0, content: { role: "model", parts: [{ text: "v" }] } }],
				}),
				payload({
					candidates: [{ index: 0, finishReason: "STOP", content: { role: "model", parts: [] } }],
				}),
			]),
	},
	{
		id: "LSA-X172",
		adapterKey: "openai-chat",
		run: () =>
			eventsFromPayloads(openaiChatAdapter({ jsonMode: true }), [
				payload({ choices: [{ index: 0, delta: { content: '{"a":1}' }, finish_reason: "stop" }] }),
			]),
	},
	{
		id: "LSA-X173",
		adapterKey: "anthropic",
		run: () =>
			eventsFromPayloads(anthropicAdapter({ jsonMode: true }), [
				payload({ type: "content_block_start", index: 0, content_block: { type: "text" } }),
				payload({
					type: "content_block_delta",
					index: 0,
					delta: { type: "text_delta", text: '{"a":1}' },
				}),
				payload({ type: "message_delta", delta: { stop_reason: "end_turn" } }),
			]),
	},
	{
		id: "LSA-X174",
		adapterKey: "openai-compatible",
		run: () =>
			eventsFromPayloads(openaiCompatibleAdapter({ provider: "groq" }), [
				payload({ choices: [{ delta: { content: "g" }, finish_reason: "stop" }] }),
			]),
	},
	{
		id: "LSA-X175",
		adapterKey: "cohere",
		run: () =>
			eventsFromPayloads(cohereAdapter(), [
				payload({
					type: "citation-start",
					index: 0,
					delta: { message: { citations: { start: 0, end: 1, text: "a" } } },
				}),
				payload({
					type: "content-delta",
					index: 0,
					delta: { message: { content: { text: "a" } } },
				}),
				payload({ type: "message-end", delta: { finish_reason: "COMPLETE" } }),
			]),
	},
	{
		id: "LSA-X176",
		adapterKey: "gemini",
		run: () =>
			eventsFromPayloads(geminiAdapter(), [
				payload({
					candidates: [
						{
							index: 0,
							groundingMetadata: { webSearchQueries: ["q"] },
							content: { parts: [{ text: "a" }] },
						},
					],
				}),
				payload({ candidates: [{ index: 0, finishReason: "STOP", content: { parts: [] } }] }),
			]),
	},
	{
		id: "LSA-X177",
		adapterKey: "bedrock",
		run: () =>
			eventsFromPayloads(bedrockAdapter(), [
				payload({
					contentBlockStart: {
						contentBlockIndex: 0,
						start: { toolUse: { toolUseId: "t1", name: "fn" } },
					},
				}),
				payload({
					contentBlockDelta: { contentBlockIndex: 0, delta: { toolUse: { input: "{}" } } },
				}),
				payload({ messageStop: { stopReason: "tool_use" } }),
			]),
	},
	{
		id: "LSA-X178",
		adapterKey: "openai-responses",
		run: () =>
			eventsFromPayloads(openaiResponsesAdapter(), [
				payload({ type: "response.output_text.delta", delta: "a" }),
				payload({ type: "response.completed", response: {} }),
			]),
	},
	{
		id: "LSA-X179",
		adapterKey: "openai-compatible",
		run: () =>
			eventsFromPayloads(openaiCompatibleAdapter({ provider: "perplexity" }), [
				payload({ citations: ["https://p.test"] }),
				payload({ choices: [{ delta: { content: "a" }, finish_reason: "stop" }] }),
			]),
	},
	{
		id: "LSA-X180",
		adapterKey: "openai-chat",
		run: async () => {
			const entry = discoverStreamFixtures().find((row) => row.id === "openai-chat/text-basic.sse");
			expect(entry).toBeDefined();
			const normalized = await runGoldenStreamParity({ entry, byteChunkSize: 17 });
			expect(normalized.length).toBeGreaterThan(0);
			return eventsFromFixture("openai-chat/text-basic.sse");
		},
	},
];

describe("cross adapter contract matrix", () => {
	const matrixRows = [...fixtureRows, ...syntheticRows];

	it("LSA-X141: contract matrix spans X141-X180", () => {
		expect(matrixRows.map((row) => row.id)).toEqual(
			Array.from({ length: 40 }, (_, index) => `LSA-X${141 + index}`),
		);
	});

	it.each(matrixRows)("$id assertStreamInvariants", async (row) => {
		const events = await row.run();
		assertStreamInvariants(events, profileForAdapterKey(row.adapterKey));
	});
});
