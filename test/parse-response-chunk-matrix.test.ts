/** Non-stream parseResponse() golden parity under byte-split file reads (TH21–TH25). */
import { describe, expect, it } from "vitest";
import { discoverResponseFixtures } from "./helpers/fixture-catalog";
import { loadGoldenExpected, runGoldenResponseParity } from "./helpers/golden-parity";

const RESPONSE_CHUNK_SIZES = [0, 1, 17, 64] as const;

describe("parse response chunk matrix", () => {
	const entries = discoverResponseFixtures().filter(
		(entry) => entry.id !== "cohere/response-format-json",
	);
	const matrixRows = entries.flatMap((entry) =>
		RESPONSE_CHUNK_SIZES.map((chunkSize) => ({
			entry,
			chunkSize,
			label: `${entry.id}@${chunkSize}`,
		})),
	);

	it("LSA-TH21: response fixture catalog is non-empty", () => {
		expect(entries.length).toBeGreaterThan(0);
	});

	it("LSA-TH22: anthropic response-text identity parity", async () => {
		const entry = entries.find((row) => row.id === "anthropic/response-text");
		expect(entry).toBeDefined();
		const events = await runGoldenResponseParity({ entry: entry!, byteChunkSize: 0 });
		expect(events).toEqual(loadGoldenExpected(entry!.expectedPath));
	});

	it("LSA-TH23: bedrock response-text chunk-1 parity", async () => {
		const entry = entries.find((row) => row.id === "bedrock/response-text");
		expect(entry).toBeDefined();
		const events = await runGoldenResponseParity({ entry: entry!, byteChunkSize: 1 });
		expect(events).toEqual(loadGoldenExpected(entry!.expectedPath));
	});

	it("LSA-TH24: gemini response-text chunk-17 parity", async () => {
		const entry = entries.find((row) => row.id === "gemini/response-text");
		expect(entry).toBeDefined();
		const events = await runGoldenResponseParity({ entry: entry!, byteChunkSize: 17 });
		expect(events).toEqual(loadGoldenExpected(entry!.expectedPath));
	});

	it("LSA-TH25: openai-chat response-text chunk-64 parity", async () => {
		const entry = entries.find((row) => row.id === "openai-chat/response-text");
		expect(entry).toBeDefined();
		const events = await runGoldenResponseParity({ entry: entry!, byteChunkSize: 64 });
		expect(events).toEqual(loadGoldenExpected(entry!.expectedPath));
	});

	it.each(matrixRows)("$label response golden parity", async ({ entry, chunkSize }) => {
		const events = await runGoldenResponseParity({ entry, byteChunkSize: chunkSize });
		expect(events).toEqual(loadGoldenExpected(entry.expectedPath));
	});
});
