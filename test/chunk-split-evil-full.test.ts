import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { evilOffsetChunkSizes } from "./helpers/byte-stream";
import { discoverStreamFixtures, evilOffsetSizesForEntry } from "./helpers/fixture-catalog";
import { loadGoldenExpected, runGoldenStreamParity } from "./helpers/golden-parity";

describe("chunk-split evil-offset full matrix", () => {
	const tier1Entries = discoverStreamFixtures().filter(
		(entry) => entry.tier === 1 && entry.id !== "cohere/response-format-json.jsonl",
	);
	const matrixRows = tier1Entries.flatMap((entry) =>
		evilOffsetSizesForEntry(entry).map((chunkSize) => ({
			entry,
			chunkSize,
			label: `${entry.id}@evil-${chunkSize}`,
		})),
	);

	it("LSA-TH31: evil-offset tier-1 matrix row count >= 450", () => {
		expect(matrixRows.length).toBeGreaterThanOrEqual(450);
	});

	it.each(matrixRows)("$label golden parity", async ({ entry, chunkSize }) => {
		const events = await runGoldenStreamParity({ entry, byteChunkSize: chunkSize });
		expect(events).toEqual(loadGoldenExpected(entry.expectedPath));
	});

	it("LSA-TH32: anthropic tool-parallel evil-offset anchor parity", async () => {
		const entry = tier1Entries.find((row) => row.id === "anthropic/tool-parallel.sse");
		expect(entry).toBeDefined();
		const expectedSizes = evilOffsetChunkSizes(
			Buffer.byteLength(readFileSync(entry!.streamPath, "utf8"), "utf8"),
		);
		const chunkSizes = evilOffsetSizesForEntry(entry!);
		expect(chunkSizes).toEqual(expectedSizes);
		const events = await runGoldenStreamParity({ entry: entry!, byteChunkSize: chunkSizes[0] });
		expect(events).toEqual(loadGoldenExpected(entry!.expectedPath));
	});

	it("LSA-TH33: gemini vertex grounding evil-offset anchor parity", async () => {
		const entry = tier1Entries.find((row) => row.id === "gemini/vertex/grounding-metadata.jsonl");
		expect(entry).toBeDefined();
		const chunkSizes = evilOffsetSizesForEntry(entry!);
		expect(chunkSizes.length).toBeGreaterThan(0);
		const events = await runGoldenStreamParity({ entry: entry!, byteChunkSize: chunkSizes[0] });
		expect(events).toEqual(loadGoldenExpected(entry!.expectedPath));
	});
});
