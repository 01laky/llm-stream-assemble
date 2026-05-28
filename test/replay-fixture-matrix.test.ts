import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runReplayFixtureExample } from "../examples/node-fetch/replay-fixture";
import { createAdapterForEntry, discoverStreamFixtures } from "./helpers/fixture-catalog";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

const REPLAY_FIXTURE_IDS = [
	"openai-chat/text-basic.sse",
	"openai-chat/tool-parallel.sse",
	"openai-chat/json-mode.sse",
	"openai-chat/usage.sse",
	"openai-responses/text-basic.sse",
	"openai-responses/parallel-function-call.sse",
	"openai-responses/incomplete.sse",
	"anthropic/text-basic.sse",
	"anthropic/tool-use.sse",
	"anthropic/tool-parallel.sse",
	"anthropic/thinking.sse",
	"anthropic/refusal.sse",
	"anthropic/json-mode.sse",
	"anthropic/usage-stream.sse",
	"gemini/text-basic.sse",
	"gemini/tool-parallel.sse",
	"gemini/json-mode.sse",
	"gemini/incomplete.sse",
	"gemini/vertex/text-basic.jsonl",
	"gemini/vertex/tool-parallel.jsonl",
	"cohere/text-basic.jsonl",
	"cohere/tool-parallel.jsonl",
	"bedrock/text-basic.jsonl",
	"bedrock/tool-single.jsonl",
	"openai-compatible/generic-text.sse",
	"openai-compatible/groq/text-basic.sse",
	"openai-compatible/azure/text-basic.sse",
	"openai-compatible/perplexity/text-basic.sse",
] as const;

describe("replay fixture matrix", () => {
	const catalog = discoverStreamFixtures();
	const matrixRows = REPLAY_FIXTURE_IDS.map((id) => {
		const entry = catalog.find((row) => row.id === id);
		if (!entry) throw new Error(`Missing replay fixture catalog entry: ${id}`);
		return { id, entry };
	});

	it("LSA-RP01: replay matrix covers at least 20 tier-1 fixtures", () => {
		expect(matrixRows.length).toBeGreaterThanOrEqual(20);
		for (const { entry } of matrixRows) {
			expect(entry.tier).toBe(1);
		}
	});

	it.each(matrixRows)("$id replay with matching adapter", async ({ entry }) => {
		const output: string[] = [];
		await runReplayFixtureExample({
			path: entry.streamPath,
			adapter: createAdapterForEntry(entry),
			write: (text) => output.push(text),
		});
		expect(output.join("").length).toBeGreaterThan(0);
	});

	it("LSA-RP02: openai-chat text-basic replay text", async () => {
		const entry = catalog.find((row) => row.id === "openai-chat/text-basic.sse");
		const output: string[] = [];
		await runReplayFixtureExample({
			path: join(rootDir, "test/fixtures/openai-chat/text-basic.sse"),
			adapter: createAdapterForEntry(entry!),
			write: (text) => output.push(text),
		});
		expect(output.join("")).toContain("Hello world");
	});

	it("LSA-RP03: anthropic tool-parallel replay finish", async () => {
		const entry = catalog.find((row) => row.id === "anthropic/tool-parallel.sse");
		const output: string[] = [];
		await runReplayFixtureExample({
			path: join(rootDir, "test/fixtures/anthropic/tool-parallel.sse"),
			adapter: createAdapterForEntry(entry!),
			write: (text) => output.push(text),
		});
		expect(output.join("")).toContain("Finish: tool_calls");
	});
});
