import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runOpenAIChatExample } from "../examples/node-fetch/openai-chat";
import {
	byteStreamFromSplitString,
	evilOffsetChunkSizes,
	readStreamToString,
} from "./helpers/byte-stream";
import {
	chunkSizesForEntry,
	discoverStreamFixtures,
	EVIL_OFFSET_SAMPLE_IDS,
	tier1FixtureCount,
} from "./helpers/fixture-catalog";
import { loadGoldenExpected, runGoldenStreamParity } from "./helpers/golden-parity";
import { runSimulatedProviderCall } from "./helpers/simulated-provider";
import { assertStreamInvariants, profileForAdapterKey } from "./helpers/stream-invariants";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const openAISse = readFileSync(join(rootDir, "test/fixtures/openai-chat/text-basic.sse"), "utf8");

describe("test hardening helpers", () => {
	it("LSA-TH01: byteStreamFromSplitString preserves UTF-8 content", async () => {
		const source = "Hello 世界 🌍";
		const stream = byteStreamFromSplitString(source, 3);
		await expect(readStreamToString(stream)).resolves.toBe(source);
	});

	it("LSA-TH02: discoverStreamFixtures tier-1 count is stable", () => {
		expect(tier1FixtureCount()).toBeGreaterThanOrEqual(160);
	});

	it("LSA-TH03: runGoldenStreamParity SSE identity matches openai text-basic golden", async () => {
		const entry = discoverStreamFixtures().find((row) => row.id === "openai-chat/text-basic.sse");
		expect(entry).toBeDefined();
		const events = await runGoldenStreamParity({ entry });
		expect(events).toEqual(loadGoldenExpected(entry!.expectedPath));
	});

	it("LSA-TH03b: runGoldenStreamParity JSONL identity matches cohere text-basic golden", async () => {
		const entry = discoverStreamFixtures().find((row) => row.id === "cohere/text-basic.jsonl");
		expect(entry).toBeDefined();
		const events = await runGoldenStreamParity({ entry });
		expect(events).toEqual(loadGoldenExpected(entry!.expectedPath));
	});

	it("LSA-TH04: runSimulatedProviderCall returns 200 with OpenAI example output", async () => {
		const result = await runSimulatedProviderCall({
			fixtureBody: openAISse,
			runExample: runOpenAIChatExample,
		});
		expect(result.status).toBe(200);
		expect(result.output).toContain("Hello world");
	});

	it("LSA-TH05: assertStreamInvariants rejects invalid sequence", () => {
		expect(() =>
			assertStreamInvariants(
				[{ type: "text.delta", text: "x" }] as never,
				profileForAdapterKey("openai-chat"),
			),
		).toThrow(/text\.delta without text\.done/);
	});
});

describe("chunk-split matrix", () => {
	const tier1 = discoverStreamFixtures().filter((entry) => entry.tier === 1);
	const tier2 = discoverStreamFixtures().filter((entry) => entry.tier === 2);
	const matrixRows = [
		...tier1.flatMap((entry) =>
			chunkSizesForEntry(entry, true).map((chunkSize) => ({
				entry,
				chunkSize,
				label: `${entry.id}@${chunkSize}`,
			})),
		),
		...tier2.flatMap((entry) =>
			chunkSizesForEntry(entry, false).map((chunkSize) => ({
				entry,
				chunkSize,
				label: `${entry.id}@${chunkSize}`,
			})),
		),
	];

	it.each(matrixRows)("$label golden parity", async ({ entry, chunkSize }) => {
		const events = await runGoldenStreamParity({ entry, byteChunkSize: chunkSize });
		expect(events).toEqual(loadGoldenExpected(entry.expectedPath));
	});

	it("LSA-TH10: openai-chat tool-parallel chunk-1 parity", async () => {
		const entry = discoverStreamFixtures().find(
			(row) => row.id === "openai-chat/tool-parallel.sse",
		);
		expect(entry).toBeDefined();
		const events = await runGoldenStreamParity({ entry, byteChunkSize: 1 });
		expect(events).toEqual(loadGoldenExpected(entry!.expectedPath));
	});

	it("LSA-TH11: openai-responses logprobs-stream chunk-17 parity", async () => {
		const entry = discoverStreamFixtures().find(
			(row) => row.id === "openai-responses/logprobs-stream.sse",
		);
		expect(entry).toBeDefined();
		const events = await runGoldenStreamParity({ entry, byteChunkSize: 17 });
		expect(events).toEqual(loadGoldenExpected(entry!.expectedPath));
	});

	it("LSA-TH12: gemini vertex tool-parallel chunk-64 parity", async () => {
		const entry = discoverStreamFixtures().find(
			(row) => row.id === "gemini/vertex/tool-parallel.jsonl",
		);
		expect(entry).toBeDefined();
		const events = await runGoldenStreamParity({ entry, byteChunkSize: 64 });
		expect(events).toEqual(loadGoldenExpected(entry!.expectedPath));
	});

	it("LSA-TH13: bedrock text-basic chunk-7 parity", async () => {
		const entry = discoverStreamFixtures().find((row) => row.id === "bedrock/text-basic.jsonl");
		expect(entry?.transport).toBe("jsonl");
		const events = await runGoldenStreamParity({ entry, byteChunkSize: 7 });
		expect(events).toEqual(loadGoldenExpected(entry!.expectedPath));
	});

	it("LSA-TH14: cohere tool-late-id chunk-3 parity", async () => {
		const entry = discoverStreamFixtures().find((row) => row.id === "cohere/tool-late-id.jsonl");
		const events = await runGoldenStreamParity({ entry, byteChunkSize: 3 });
		expect(events).toEqual(loadGoldenExpected(entry!.expectedPath));
	});

	it("LSA-TH15: anthropic tool-use chunk-31 parity", async () => {
		const entry = discoverStreamFixtures().find((row) => row.id === "anthropic/tool-use.sse");
		const events = await runGoldenStreamParity({ entry, byteChunkSize: 31 });
		expect(events).toEqual(loadGoldenExpected(entry!.expectedPath));
	});

	it("LSA-TH16: groq logprobs-stream chunk-1 parity", async () => {
		const entry = discoverStreamFixtures().find(
			(row) => row.id === "openai-compatible/groq/logprobs-stream.sse",
		);
		const events = await runGoldenStreamParity({ entry, byteChunkSize: 1 });
		expect(events).toEqual(loadGoldenExpected(entry!.expectedPath));
	});

	it("LSA-TH17: azure content-filter-block chunk-17 parity", async () => {
		const entry = discoverStreamFixtures().find(
			(row) => row.id === "openai-compatible/azure/content-filter-block.sse",
		);
		const events = await runGoldenStreamParity({ entry, byteChunkSize: 17 });
		expect(events).toEqual(loadGoldenExpected(entry!.expectedPath));
	});

	it("LSA-TH18: evil offset sample fixtures exist", () => {
		const ids = discoverStreamFixtures()
			.filter((entry) => entry.evilOffsetSample)
			.map((entry) => entry.id);
		for (const id of EVIL_OFFSET_SAMPLE_IDS) {
			expect(ids).toContain(id);
		}
	});

	it("LSA-TH19: parameterized matrix length >= 1000", () => {
		expect(matrixRows.length).toBeGreaterThanOrEqual(1000);
	});

	it("LSA-TH26: evil offset sizes are applied for openai-chat text-basic", () => {
		const entry = discoverStreamFixtures().find((row) => row.id === "openai-chat/text-basic.sse");
		const raw = readFileSync(entry!.streamPath, "utf8");
		const sizes = chunkSizesForEntry(entry!, true);
		for (const size of evilOffsetChunkSizes(Buffer.byteLength(raw, "utf8"))) {
			expect(sizes).toContain(size);
		}
	});

	it("LSA-TH27: evil offset sizes are applied for cohere text-basic", () => {
		const entry = discoverStreamFixtures().find((row) => row.id === "cohere/text-basic.jsonl");
		const raw = readFileSync(entry!.streamPath, "utf8");
		const sizes = chunkSizesForEntry(entry!, true);
		for (const size of evilOffsetChunkSizes(Buffer.byteLength(raw, "utf8"))) {
			expect(sizes).toContain(size);
		}
	});

	it("LSA-TH28: evil offset sample count is 10", () => {
		expect(discoverStreamFixtures().filter((entry) => entry.evilOffsetSample).length).toBe(10);
	});
});

describe("chunk-split extended sizes", () => {
	const extendedSizes = [128, 256] as const;
	const rows = discoverStreamFixtures()
		.filter((entry) => entry.tier === 1)
		.filter((entry) => readFileSync(entry.streamPath).length < 16_384)
		.flatMap((entry) =>
			extendedSizes.map((chunkSize) => ({
				entry,
				chunkSize,
				label: `${entry.id}@${chunkSize}`,
			})),
		);

	it.each(rows)("$label golden parity", async ({ entry, chunkSize }) => {
		const events = await runGoldenStreamParity({ entry, byteChunkSize: chunkSize });
		expect(events).toEqual(loadGoldenExpected(entry.expectedPath));
	});

	it("LSA-TH20: extended matrix row count >= 300", () => {
		expect(rows.length).toBeGreaterThanOrEqual(300);
	});
});
