import { describe, expect, it } from "vitest";
import {
	discoverEdgeCatalogFixtures,
	discoverStreamFixtures,
	TIER2_CHUNK_SIZES,
	type FixtureCatalogEntry,
} from "./helpers/fixture-catalog";
import { loadGoldenExpected, runGoldenStreamParity } from "./helpers/golden-parity";

function mergedTier2Fixtures(): FixtureCatalogEntry[] {
	const entries = [...discoverStreamFixtures(), ...discoverEdgeCatalogFixtures()].filter(
		(entry) => entry.tier === 2,
	);
	return [...new Map(entries.map((entry) => [entry.id, entry])).values()].sort((a, b) =>
		a.id.localeCompare(b.id),
	);
}

describe("chunk-split tier-2 matrix", () => {
	const tier2Entries = mergedTier2Fixtures();
	const matrixRows = tier2Entries.flatMap((entry) =>
		TIER2_CHUNK_SIZES.map((chunkSize) => ({
			entry,
			chunkSize,
			label: `${entry.id}@${chunkSize}`,
		})),
	);

	it("LSA-TH100: tier-2 fixture count >= 8", () => {
		expect(tier2Entries.length).toBeGreaterThanOrEqual(8);
		expect(TIER2_CHUNK_SIZES).toEqual([1, 17, 64]);
	});

	it.each(matrixRows)("$label golden parity", async ({ entry, chunkSize }) => {
		const events = await runGoldenStreamParity({ entry, byteChunkSize: chunkSize });
		expect(events).toEqual(loadGoldenExpected(entry.expectedPath));
	});

	it("LSA-TH101: tier2-large-1 chunk-1 anchor parity", async () => {
		const entry = tier2Entries.find((row) => row.id === "edge-catalog/tier2-large-1.sse");
		expect(entry).toBeDefined();
		const events = await runGoldenStreamParity({ entry: entry!, byteChunkSize: 1 });
		expect(events).toEqual(loadGoldenExpected(entry!.expectedPath));
	});

	it("LSA-TH102: tier2-large-2 chunk-17 anchor parity", async () => {
		const entry = tier2Entries.find((row) => row.id === "edge-catalog/tier2-large-2.sse");
		expect(entry).toBeDefined();
		const events = await runGoldenStreamParity({ entry: entry!, byteChunkSize: 17 });
		expect(events).toEqual(loadGoldenExpected(entry!.expectedPath));
	});

	it("LSA-TH103: tier2-large-3 chunk-64 anchor parity", async () => {
		const entry = tier2Entries.find((row) => row.id === "edge-catalog/tier2-large-3.sse");
		expect(entry).toBeDefined();
		const events = await runGoldenStreamParity({ entry: entry!, byteChunkSize: 64 });
		expect(events).toEqual(loadGoldenExpected(entry!.expectedPath));
	});

	it("LSA-TH104: tier2-large-4 chunk-1 anchor parity", async () => {
		const entry = tier2Entries.find((row) => row.id === "edge-catalog/tier2-large-4.sse");
		expect(entry).toBeDefined();
		const events = await runGoldenStreamParity({ entry: entry!, byteChunkSize: 1 });
		expect(events).toEqual(loadGoldenExpected(entry!.expectedPath));
	});

	it("LSA-TH105: tier2-large-5 chunk-17 anchor parity", async () => {
		const entry = tier2Entries.find((row) => row.id === "edge-catalog/tier2-large-5.sse");
		expect(entry).toBeDefined();
		const events = await runGoldenStreamParity({ entry: entry!, byteChunkSize: 17 });
		expect(events).toEqual(loadGoldenExpected(entry!.expectedPath));
	});
});
