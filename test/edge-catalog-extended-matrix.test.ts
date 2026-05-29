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

const EXTENDED_CHUNK_SIZES = [3, 7, 31] as const;

const POST_REFACTOR_EC_PATTERN = /^edge-catalog\/ec(7[3-9]|8[0-8])-/;

function profileForEdgeEntry(entry: FixtureCatalogEntry) {
	const profile = profileForAdapterKey(entry.adapterKey);
	if (/logprob/.test(entry.id)) {
		return { ...profile, checkLogprobOrder: false };
	}
	return profile;
}

describe("edge-catalog extended matrix", () => {
	const edgeEntries = discoverEdgeCatalogFixtures();
	const postRefactorEntries = edgeEntries.filter((entry) =>
		POST_REFACTOR_EC_PATTERN.test(entry.id),
	);
	const extendedRows = postRefactorEntries.flatMap((entry) =>
		EXTENDED_CHUNK_SIZES.map((chunkSize) => ({
			entry,
			chunkSize,
			label: `${entry.id}@${chunkSize}`,
		})),
	);

	async function runParityWithInvariants(
		entry: FixtureCatalogEntry,
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

	it("LSA-EC73: post-refactor edge catalog fixtures count >= 16", () => {
		expect(postRefactorEntries.length).toBeGreaterThanOrEqual(16);
	});

	it.each(extendedRows)("$label golden parity with invariants", async ({ entry, chunkSize }) => {
		const events = await runParityWithInvariants(entry, chunkSize);
		expect(events).toEqual(loadGoldenExpected(entry.expectedPath));
	});

	it("LSA-EC88: EC73–EC88 pass evil-offset byte parity", async () => {
		expect(postRefactorEntries.length).toBeGreaterThanOrEqual(16);
		for (const entry of postRefactorEntries) {
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
