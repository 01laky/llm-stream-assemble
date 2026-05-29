import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { evilOffsetChunkSizes } from "./helpers/byte-stream";
import { discoverEdgeCatalogFixtures, evilOffsetSizesForEntry } from "./helpers/fixture-catalog";
import {
	loadGoldenExpected,
	normalizeForAdapterKey,
	runGoldenStreamParity,
} from "./helpers/golden-parity";
import { assertStreamInvariants, profileForAdapterKey } from "./helpers/stream-invariants";
import type { FixtureCatalogEntry } from "./helpers/fixture-catalog";

const EDGE_CHUNK_SIZES = [0, 1, 17] as const;

function profileForEdgeEntry(entry: FixtureCatalogEntry) {
	const profile = profileForAdapterKey(entry.adapterKey);
	if (/logprob/.test(entry.id)) {
		return { ...profile, checkLogprobOrder: false };
	}
	return profile;
}

describe("edge-catalog matrix", () => {
	const edgeEntries = discoverEdgeCatalogFixtures();
	const matrixRows = edgeEntries.flatMap((entry) =>
		EDGE_CHUNK_SIZES.map((chunkSize) => ({
			entry,
			chunkSize,
			label: `${entry.id}@${chunkSize}`,
		})),
	);
	const unicodeEntries = edgeEntries.filter((entry) =>
		/^edge-catalog\/ec(6[5-9]|7[0-2])-/.test(entry.id),
	);

	async function runParityWithInvariants(
		entry: (typeof edgeEntries)[number],
		chunkSize: number,
	): Promise<unknown[]> {
		return runGoldenStreamParity({
			entry,
			byteChunkSize: chunkSize,
			normalize: (events) => {
				assertStreamInvariants(events, profileForEdgeEntry(entry));
				return normalizeForAdapterKey(entry.adapterKey, events);
			},
		});
	}

	it("LSA-MAINT44: edge catalog fixture count >= 88", () => {
		expect(edgeEntries.length).toBeGreaterThanOrEqual(88);
	});

	it.each(matrixRows)("$label golden parity with invariants", async ({ entry, chunkSize }) => {
		const events = await runParityWithInvariants(entry, chunkSize);
		expect(events).toEqual(loadGoldenExpected(entry.expectedPath));
	});

	it("LSA-EC01: ec01 sse midline split anchor parity", async () => {
		const entry = edgeEntries.find((row) => row.id === "edge-catalog/ec01-sse-midline-split.sse");
		expect(entry).toBeDefined();
		const events = await runParityWithInvariants(entry!, 1);
		expect(events).toEqual(loadGoldenExpected(entry!.expectedPath));
	});

	it("LSA-EC65: unicode edge fixtures pass evil-offset parity", async () => {
		expect(unicodeEntries.length).toBeGreaterThanOrEqual(8);
		for (const entry of unicodeEntries) {
			const expectedSizes = evilOffsetChunkSizes(
				Buffer.byteLength(readFileSync(entry.streamPath, "utf8"), "utf8"),
			);
			const chunkSizes = evilOffsetSizesForEntry(entry);
			expect(chunkSizes).toEqual(expectedSizes);
			for (const chunkSize of chunkSizes) {
				const events = await runParityWithInvariants(entry, chunkSize);
				expect(events).toEqual(loadGoldenExpected(entry.expectedPath));
			}
		}
	});
});
