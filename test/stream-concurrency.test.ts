import { describe, expect, it } from "vitest";
import { discoverStreamFixtures } from "./helpers/fixture-catalog";
import { loadGoldenExpected, runGoldenStreamParity } from "./helpers/golden-parity";

describe("stream concurrency", () => {
	const sampleIds = [
		"openai-chat/text-basic.sse",
		"anthropic/text-basic.sse",
		"gemini/text-basic.sse",
	] as const;

	it("LSA-X181: parallel runGoldenStreamParity on distinct fixtures", async () => {
		const entries = sampleIds.map((id) => {
			const entry = discoverStreamFixtures().find((row) => row.id === id);
			if (!entry) throw new Error(`Missing fixture ${id}`);
			return entry;
		});
		const results = await Promise.all(entries.map((entry) => runGoldenStreamParity({ entry })));
		for (let index = 0; index < entries.length; index += 1) {
			expect(results[index]).toEqual(loadGoldenExpected(entries[index]!.expectedPath));
		}
	});

	it("LSA-X182: concurrent parity calls reuse no shared adapter state", async () => {
		const entry = discoverStreamFixtures().find(
			(row) => row.id === "openai-chat/tool-parallel.sse",
		);
		expect(entry).toBeDefined();
		const runs = await Promise.all(
			Array.from({ length: 4 }, () => runGoldenStreamParity({ entry, byteChunkSize: 7 })),
		);
		const expected = loadGoldenExpected(entry!.expectedPath);
		for (const result of runs) {
			expect(result).toEqual(expected);
		}
	});

	it("LSA-X183: mixed-chunk concurrent parity on anthropic and cohere", async () => {
		const anthropic = discoverStreamFixtures().find((row) => row.id === "anthropic/tool-use.sse");
		const cohere = discoverStreamFixtures().find((row) => row.id === "cohere/text-basic.jsonl");
		expect(anthropic).toBeDefined();
		expect(cohere).toBeDefined();
		const [anthropicEvents, cohereEvents] = await Promise.all([
			runGoldenStreamParity({ entry: anthropic, byteChunkSize: 3 }),
			runGoldenStreamParity({ entry: cohere, byteChunkSize: 17 }),
		]);
		expect(anthropicEvents).toEqual(loadGoldenExpected(anthropic!.expectedPath));
		expect(cohereEvents).toEqual(loadGoldenExpected(cohere!.expectedPath));
	});
});
