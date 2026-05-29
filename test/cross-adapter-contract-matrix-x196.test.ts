import { describe, expect, it } from "vitest";
import { discoverStreamFixtures, evilOffsetSizesForEntry } from "./helpers/fixture-catalog";
import {
	loadGoldenExpected,
	normalizeForAdapterKey,
	runGoldenStreamParity,
} from "./helpers/golden-parity";
import { assertStreamInvariants, profileForAdapterKey } from "./helpers/stream-invariants";

type ContractRow = {
	entry: ReturnType<typeof discoverStreamFixtures>[number];
	chunkSize: number;
	mode: "chunk-1" | "evil";
	label: string;
};

function buildRows(): ContractRow[] {
	const tier1Entries = discoverStreamFixtures().filter(
		(entry) => entry.tier === 1 && !entry.id.includes("logprobs"),
	);
	const chunkOneRows: ContractRow[] = tier1Entries.map((entry) => ({
		entry,
		chunkSize: 1,
		mode: "chunk-1",
		label: `${entry.id}@1`,
	}));
	const evilRows: ContractRow[] = tier1Entries
		.filter((entry) => entry.evilOffsetSample === true)
		.flatMap((entry) =>
			evilOffsetSizesForEntry(entry)
				.filter((size) => size !== 1)
				.map((size) => ({
					entry,
					chunkSize: size,
					mode: "evil" as const,
					label: `${entry.id}@evil-${size}`,
				})),
		);
	return [...chunkOneRows, ...evilRows].sort((a, b) => a.label.localeCompare(b.label));
}

describe("cross adapter contract matrix x196-x280", () => {
	const rows = buildRows();
	const gatedRows = rows.map((row, index) => ({
		...row,
		gate: index < 84 ? `LSA-X${197 + index}` : "LSA-X280+",
	}));

	it("LSA-X196: chunk-1 and evil contract matrix expands to >= 150 rows", () => {
		expect(rows.length).toBeGreaterThanOrEqual(150);
		expect(rows.some((row) => row.mode === "chunk-1")).toBe(true);
		expect(rows.some((row) => row.mode === "evil")).toBe(true);
	});

	it.each(gatedRows)("$gate $label parity and invariants", async ({ entry, chunkSize }) => {
		const normalized = await runGoldenStreamParity({
			entry,
			byteChunkSize: chunkSize,
			normalize: (events) => {
				assertStreamInvariants(events, profileForAdapterKey(entry.adapterKey));
				return normalizeForAdapterKey(entry.adapterKey, events);
			},
		});
		expect(normalized).toEqual(loadGoldenExpected(entry.expectedPath));
	});
});
