import { describe, expect, it } from "vitest";
import { anthropicAdapter } from "../src/adapters/anthropic";
import { bedrockAdapter } from "../src/adapters/bedrock";
import { cohereAdapter } from "../src/adapters/cohere";
import { geminiAdapter } from "../src/adapters/gemini";
import { openaiChatAdapter } from "../src/adapters/openai-chat";
import { openaiCompatibleAdapter } from "../src/adapters/openai-compatible";
import { openaiResponsesAdapter } from "../src/adapters/openai-responses";
import { assembleFromPayloads } from "../src/core/assemble-payloads";
import { EventAssembler } from "../src/core/assembler/event-assembler";
import type { StreamAdapter, StreamEvent } from "../src/core/types";
import { collectAsync, strings } from "./helpers/collect-events";
import {
	buildFinishTrailingRows,
	FINISH_TRAILING_DROP_POLICY,
	FINISH_TRAILING_KINDS,
	FINISH_TRAILING_REASONS,
} from "./helpers/finish-trailing-matrix";

const payload = (value: unknown) => JSON.stringify(value);

interface IntegrationRow {
	label: string;
	adapter: StreamAdapter;
	payloads: string[];
	marker: string;
}

describe("finish trailing event matrix", () => {
	const unitRows = buildFinishTrailingRows();

	it("LSA-X311: finish trailing matrix has >= 70 EventAssembler rows", () => {
		expect(unitRows.length).toBeGreaterThanOrEqual(70);
	});

	it.each(unitRows)("LSA-X312 $label drops post-finish trailing chunk", (row) => {
		const assembler = new EventAssembler();
		const events = row.sequence.flatMap((chunk) => assembler.push(chunk));
		expect(assembler.hasFinished()).toBe(true);
		expect(
			events.some((event) => event.type === "finish" && event.reason === row.finishReason),
		).toBe(true);
		expect(JSON.stringify(events)).not.toContain(row.trailingMarker);
	});

	it("LSA-X313: documented drop policy states trailing chunks are ignored", () => {
		expect(FINISH_TRAILING_DROP_POLICY).toContain("trailing chunks are dropped");
	});

	it("LSA-X314: matrix covers all finish reasons and trailing kinds", () => {
		expect(new Set(unitRows.map((row) => row.finishReason))).toEqual(
			new Set(FINISH_TRAILING_REASONS),
		);
		expect(new Set(unitRows.map((row) => row.trailingKind))).toEqual(
			new Set(FINISH_TRAILING_KINDS),
		);
	});

	const integrationRows: IntegrationRow[] = [
		{
			label: "openai-chat late text delta",
			adapter: openaiChatAdapter(),
			marker: "late:openai-chat",
			payloads: [
				payload({
					id: "cmpl",
					object: "chat.completion.chunk",
					choices: [{ index: 0, delta: { content: "ok" }, finish_reason: null }],
				}),
				payload({
					id: "cmpl",
					object: "chat.completion.chunk",
					choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
				}),
				payload({
					id: "cmpl",
					object: "chat.completion.chunk",
					choices: [{ index: 0, delta: { content: "late:openai-chat" }, finish_reason: null }],
				}),
			],
		},
		{
			label: "openai-responses late text delta",
			adapter: openaiResponsesAdapter(),
			marker: "late:responses",
			payloads: [
				payload({ type: "response.output_text.delta", delta: "ok" }),
				payload({ type: "response.completed", response: {} }),
				payload({ type: "response.output_text.delta", delta: "late:responses" }),
			],
		},
		{
			label: "anthropic late text delta",
			adapter: anthropicAdapter(),
			marker: "late:anthropic",
			payloads: [
				payload({
					type: "content_block_delta",
					index: 0,
					delta: { type: "text_delta", text: "ok" },
				}),
				payload({ type: "message_delta", delta: { stop_reason: "end_turn" } }),
				payload({
					type: "content_block_delta",
					index: 0,
					delta: { type: "text_delta", text: "late:anthropic" },
				}),
			],
		},
		{
			label: "gemini late text part",
			adapter: geminiAdapter(),
			marker: "late:gemini",
			payloads: [
				payload({ candidates: [{ index: 0, content: { parts: [{ text: "ok" }] } }] }),
				payload({ candidates: [{ index: 0, finishReason: "STOP", content: { parts: [] } }] }),
				payload({
					candidates: [{ index: 0, content: { parts: [{ text: "late:gemini" }] } }],
				}),
			],
		},
		{
			label: "cohere late citation",
			adapter: cohereAdapter(),
			marker: "late:cohere",
			payloads: [
				payload({
					type: "message-start",
					id: "m1",
					delta: { message: { role: "assistant" } },
				}),
				payload({
					type: "content-delta",
					index: 0,
					delta: { message: { content: { text: "ok" } } },
				}),
				payload({ type: "message-end", delta: { finish_reason: "COMPLETE" } }),
				payload({
					type: "citation-start",
					index: 0,
					delta: { message: { citations: { start: 0, end: 11, text: "late:cohere" } } },
				}),
			],
		},
		{
			label: "bedrock late metadata",
			adapter: bedrockAdapter(),
			marker: "late:bedrock",
			payloads: [
				payload({ messageStart: { role: "assistant" } }),
				payload({ contentBlockDelta: { contentBlockIndex: 0, delta: { text: "ok" } } }),
				payload({ messageStop: { stopReason: "end_turn" } }),
				payload({ metadata: { trace: { marker: "late:bedrock" } } }),
			],
		},
		{
			label: "openai-compatible late citation",
			adapter: openaiCompatibleAdapter({ provider: "perplexity" }),
			marker: "late:compatible",
			payloads: [
				payload({
					choices: [{ index: 0, delta: { content: "ok" }, finish_reason: "stop" }],
				}),
				payload({ citations: ["https://late:compatible.test"] }),
			],
		},
	];

	it("LSA-X315: adapter integration subset has >= 7 rows", () => {
		expect(integrationRows.length).toBeGreaterThanOrEqual(7);
	});

	it.each(integrationRows)("LSA-X316 $label drops trailing adapter chunks", async (row) => {
		const events = await collectAsync(assembleFromPayloads(strings(...row.payloads), row.adapter));
		expect(finishEvents(events)).toHaveLength(1);
		expect(JSON.stringify(events)).not.toContain(row.marker);
	});
});

function finishEvents(events: StreamEvent[]): Array<Extract<StreamEvent, { type: "finish" }>> {
	return events.filter(
		(event): event is Extract<StreamEvent, { type: "finish" }> => event.type === "finish",
	);
}
