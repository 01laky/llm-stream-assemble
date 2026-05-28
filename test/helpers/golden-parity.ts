import { readFileSync } from "node:fs";
import type { StreamAdapter, StreamEvent } from "../../src/core/types";
import { assembleFromPayloads } from "../../src/core/assemble-payloads";
import { assembleResponse } from "../../src/core/assemble-response";
import { assembleStream } from "../../src/core/assemble-stream";
import { normalizeAnthropicEvents } from "./anthropic-fixtures";
import { byteStreamFromSplitString, jsonlLinesFromByteStream } from "./byte-stream";
import { normalizeBedrockEvents } from "./bedrock-fixtures";
import { normalizeCohereEvents } from "./cohere-fixtures";
import { normalizeCompatibleEvents } from "./compatible-fixtures";
import {
	createAdapterForEntry,
	type FixtureCatalogEntry,
	type ResponseFixtureEntry,
} from "./fixture-catalog";
import { normalizeGeminiEvents } from "./gemini-fixtures";
import { normalizeEvents, normalizeRawChunks } from "./openai-fixtures";
import { normalizeResponsesEvents } from "./responses-fixtures";
import { collectAsync } from "./collect-events";
import { readExpectedEvents } from "./adapter-conformance";

export type FixtureTransport = "sse" | "jsonl";

export interface GoldenStreamParityOptions {
	adapter?: StreamAdapter;
	entry?: FixtureCatalogEntry;
	fixturePath?: string;
	expectedPath?: string;
	transport?: FixtureTransport;
	byteChunkSize?: number;
	normalize?: (events: StreamEvent[]) => unknown[];
	adapterFactory?: () => StreamAdapter;
}

export function normalizeForAdapterKey(adapterKey: string, events: StreamEvent[]): unknown[] {
	switch (adapterKey) {
		case "openai-chat":
			return normalizeEvents(events);
		case "openai-responses":
			return normalizeResponsesEvents(events);
		case "anthropic":
			return normalizeAnthropicEvents(events);
		case "gemini":
		case "gemini-vertex":
			return normalizeGeminiEvents(events);
		case "cohere":
			return normalizeCohereEvents(events);
		case "bedrock":
			return normalizeBedrockEvents(events);
		default:
			if (adapterKey.startsWith("openai-compatible")) {
				return normalizeCompatibleEvents(events);
			}
			return events;
	}
}

export async function runGoldenStreamParity(
	options: GoldenStreamParityOptions,
): Promise<unknown[]> {
	const entry = options.entry;
	const fixturePath = options.fixturePath ?? entry?.streamPath;
	const expectedPath = options.expectedPath ?? entry?.expectedPath;
	const transport = options.transport ?? entry?.transport;
	const adapterKey = entry?.adapterKey ?? "openai-chat";
	if (!fixturePath || !expectedPath || !transport) {
		throw new Error("runGoldenStreamParity requires fixturePath, expectedPath, and transport");
	}
	const raw = readFileSync(fixturePath, "utf8");
	const adapter =
		options.adapterFactory?.() ??
		options.adapter ??
		(entry ? createAdapterForEntry(entry) : undefined);
	if (!adapter) throw new Error("runGoldenStreamParity requires adapter");
	const chunkSize = options.byteChunkSize ?? 0;
	const stream = byteStreamFromSplitString(raw, chunkSize);
	let events: StreamEvent[];
	if (transport === "sse") {
		events = await collectAsync(assembleStream(stream, adapter));
	} else {
		events = await collectAsync(assembleFromPayloads(jsonlLinesFromByteStream(stream), adapter));
	}
	const normalize = options.normalize ?? ((evts) => normalizeForAdapterKey(adapterKey, evts));
	return normalize(events);
}

export interface GoldenResponseParityOptions {
	entry: ResponseFixtureEntry;
	byteChunkSize?: number;
}

export async function runGoldenResponseParity(
	options: GoldenResponseParityOptions,
): Promise<unknown[]> {
	const raw = readFileSync(options.entry.responsePath, "utf8");
	const adapter = createAdapterForEntry(options.entry);
	const chunkSize = options.byteChunkSize ?? 0;
	if (chunkSize <= 0 || chunkSize >= Buffer.byteLength(raw, "utf8")) {
		const events = assembleResponse(JSON.parse(raw) as unknown, adapter);
		return normalizeForAdapterKey(options.entry.adapterKey, events);
	}
	let parsed = "";
	const stream = byteStreamFromSplitString(raw, chunkSize);
	const reader = stream.getReader();
	const decoder = new TextDecoder();
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		parsed += decoder.decode(value, { stream: true });
	}
	parsed += decoder.decode();
	const events = assembleResponse(JSON.parse(parsed) as unknown, adapter);
	return normalizeForAdapterKey(options.entry.adapterKey, events);
}

export function loadGoldenExpected(expectedPath: string): unknown {
	return readExpectedEvents(expectedPath);
}

export { normalizeRawChunks };
