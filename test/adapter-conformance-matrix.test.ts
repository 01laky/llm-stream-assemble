import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { StreamEvent } from "../src/core/types";
import { assembleFromPayloads } from "../src/core/assemble-payloads";
import { assembleStream } from "../src/core/assemble-stream";
import { byteStreamFromSplitString, jsonlLinesFromByteStream } from "./helpers/byte-stream";
import { collectAsync } from "./helpers/collect-events";
import { createAdapterForEntry, discoverStreamFixtures } from "./helpers/fixture-catalog";
import { loadGoldenExpected, runGoldenStreamParity } from "./helpers/golden-parity";
import { assertStreamInvariants, profileForAdapterKey } from "./helpers/stream-invariants";

async function collectStreamEvents(
	entry: ReturnType<typeof discoverStreamFixtures>[number],
): Promise<StreamEvent[]> {
	const raw = readFileSync(entry.streamPath, "utf8");
	const adapter = createAdapterForEntry(entry);
	const stream = byteStreamFromSplitString(raw, 0);
	if (entry.transport === "sse") {
		return collectAsync(assembleStream(stream, adapter));
	}
	return collectAsync(assembleFromPayloads(jsonlLinesFromByteStream(stream), adapter));
}

describe("adapter conformance matrix", () => {
	const tier1 = discoverStreamFixtures().filter((entry) => entry.tier === 1);
	const matrixRows = tier1.map((entry) => ({
		entry,
		label: entry.id,
	}));
	const invariantRows = tier1.filter((entry) => !entry.id.includes("logprobs"));

	it("LSA-AC01: tier-1 fixture count supports conformance matrix", () => {
		expect(matrixRows.length).toBeGreaterThanOrEqual(150);
	});

	it.each(matrixRows)("$label golden parity at identity chunk size", async ({ entry }) => {
		const events = await runGoldenStreamParity({ entry, byteChunkSize: 0 });
		expect(events).toEqual(loadGoldenExpected(entry.expectedPath));
	});

	it.each(invariantRows.map((entry) => ({ entry, label: entry.id })))(
		"$label stream invariants",
		async ({ entry }) => {
			const events = await collectStreamEvents(entry);
			assertStreamInvariants(events, profileForAdapterKey(entry.adapterKey));
		},
	);

	it("LSA-AC02: anthropic tool-parallel golden parity", async () => {
		const entry = discoverStreamFixtures().find((row) => row.id === "anthropic/tool-parallel.sse");
		expect(entry).toBeDefined();
		const events = await runGoldenStreamParity({ entry });
		expect(events).toEqual(loadGoldenExpected(entry!.expectedPath));
	});

	it("LSA-AC03: anthropic json-mode golden parity", async () => {
		const entry = discoverStreamFixtures().find((row) => row.id === "anthropic/json-mode.sse");
		expect(entry).toBeDefined();
		const events = await runGoldenStreamParity({ entry });
		expect(events).toEqual(loadGoldenExpected(entry!.expectedPath));
	});

	it("LSA-AC04: cohere response-format-json excluded from catalog matrix", () => {
		const ids = discoverStreamFixtures().map((entry) => entry.id);
		expect(ids).not.toContain("cohere/response-format-json.jsonl");
	});
});
