import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { assembleFromPayloads } from "../src/core/assemble-payloads";
import { assembleStream } from "../src/core/assemble-stream";
import type { StreamEvent } from "../src/core/types";
import { byteStreamFromSplitString, jsonlLinesFromByteStream } from "./helpers/byte-stream";
import { collectAsync } from "./helpers/collect-events";
import { createAdapterForEntry, discoverStreamFixtures } from "./helpers/fixture-catalog";
import {
	assertEventOrdering,
	assertStreamInvariants,
	profileForAdapterKey,
} from "./helpers/stream-invariants";

async function eventsForRow(
	entry: ReturnType<typeof discoverStreamFixtures>[number],
	chunkSize: number,
): Promise<StreamEvent[]> {
	const raw = readFileSync(entry.streamPath, "utf8");
	const stream = byteStreamFromSplitString(raw, chunkSize);
	const adapter = createAdapterForEntry(entry);
	if (entry.transport === "sse") {
		return collectAsync(assembleStream(stream, adapter));
	}
	return collectAsync(assembleFromPayloads(jsonlLinesFromByteStream(stream), adapter));
}

describe("stream invariants matrix", () => {
	const tier1 = discoverStreamFixtures()
		.filter((entry) => entry.tier === 1 && !entry.id.includes("logprobs"))
		.slice(0, 120);
	const rows = tier1.flatMap((entry) =>
		[0, 1].map((chunkSize) => ({
			entry,
			chunkSize,
			label: `${entry.id}@${chunkSize}`,
		})),
	);

	it("LSA-AC100: matrix expands to >= 100 fixture/chunk rows", () => {
		expect(rows.length).toBeGreaterThanOrEqual(100);
		expect(rows.some((row) => row.entry.transport === "sse")).toBe(true);
		expect(rows.some((row) => row.entry.transport === "jsonl")).toBe(true);
	});

	it.each(rows)("LSA-AC101 $label invariants and ordering", async ({ entry, chunkSize }) => {
		const events = await eventsForRow(entry, chunkSize);
		const profile = profileForAdapterKey(entry.adapterKey);
		assertStreamInvariants(events, profile);
		assertEventOrdering(events, profile);
	});

	it("LSA-AC102: openai-chat text-basic ordering anchor", async () => {
		const entry = discoverStreamFixtures().find((row) => row.id === "openai-chat/text-basic.sse");
		expect(entry).toBeDefined();
		const events = await eventsForRow(entry!, 1);
		assertEventOrdering(events, profileForAdapterKey(entry!.adapterKey));
	});

	it("LSA-AC103: openai-responses text-basic ordering anchor", async () => {
		const entry = discoverStreamFixtures().find(
			(row) => row.id === "openai-responses/text-basic.sse",
		);
		expect(entry).toBeDefined();
		const events = await eventsForRow(entry!, 1);
		assertEventOrdering(events, profileForAdapterKey(entry!.adapterKey));
	});

	it("LSA-AC104: bedrock text-basic ordering anchor", async () => {
		const entry = discoverStreamFixtures().find((row) => row.id === "bedrock/text-basic.jsonl");
		expect(entry).toBeDefined();
		const events = await eventsForRow(entry!, 1);
		assertEventOrdering(events, profileForAdapterKey(entry!.adapterKey));
	});
});
