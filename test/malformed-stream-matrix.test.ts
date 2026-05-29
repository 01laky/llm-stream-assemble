import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { anthropicAdapter } from "../src/adapters/anthropic";
import { bedrockAdapter } from "../src/adapters/bedrock";
import { cohereAdapter } from "../src/adapters/cohere";
import { geminiAdapter } from "../src/adapters/gemini";
import { openaiChatAdapter } from "../src/adapters/openai-chat";
import { openaiCompatibleAdapter } from "../src/adapters/openai-compatible";
import { openaiResponsesAdapter } from "../src/adapters/openai-responses";
import type { StreamAdapter } from "../src/core/types";
import { assembleFromPayloads } from "../src/core/assemble-payloads";
import { assembleStream } from "../src/core/assemble-stream";
import { byteStreamFromSplitString, jsonlLinesFromByteStream } from "./helpers/byte-stream";
import { collectAsync } from "./helpers/collect-events";

const malformedDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures/malformed");

function malformedFiles(): string[] {
	return readdirSync(malformedDir).filter(
		(name) => name.endsWith(".sse") || name.endsWith(".jsonl"),
	);
}

async function assembleMalformed(
	path: string,
	transport: "sse" | "jsonl",
	adapter: StreamAdapter,
): Promise<unknown[]> {
	const raw = readFileSync(path, "utf8");
	const stream = byteStreamFromSplitString(raw, 1);
	if (transport === "sse") {
		return collectAsync(assembleStream(stream, adapter, { recoverMalformed: true }));
	}
	return collectAsync(
		assembleFromPayloads(jsonlLinesFromByteStream(stream), adapter, { recoverMalformed: true }),
	);
}

describe("malformed stream matrix", () => {
	const files = malformedFiles();

	it("LSA-NR01: malformed fixture directory has at least 10 files", () => {
		expect(files.length).toBeGreaterThanOrEqual(10);
	});

	it.each(files.map((name) => [name, join(malformedDir, name)] as const))(
		"LSA-NR02 %s openai-chat does not throw",
		async (_name, path) => {
			await expect(
				assembleMalformed(path, path.endsWith(".jsonl") ? "jsonl" : "sse", openaiChatAdapter()),
			).resolves.toBeDefined();
		},
	);

	it.each(
		files
			.filter((name) => name.endsWith(".sse"))
			.map((name) => [name, join(malformedDir, name)] as const),
	)("LSA-NR03 %s anthropic does not throw", async (_name, path) => {
		await expect(assembleMalformed(path, "sse", anthropicAdapter())).resolves.toBeDefined();
	});

	it.each(
		files
			.filter((name) => name.endsWith(".sse"))
			.map((name) => [name, join(malformedDir, name)] as const),
	)("LSA-NR04 %s openai-responses does not throw", async (_name, path) => {
		await expect(assembleMalformed(path, "sse", openaiResponsesAdapter())).resolves.toBeDefined();
	});

	it.each(
		files
			.filter((name) => name.endsWith(".sse"))
			.map((name) => [name, join(malformedDir, name)] as const),
	)("LSA-NR05 %s gemini does not throw", async (_name, path) => {
		await expect(assembleMalformed(path, "sse", geminiAdapter())).resolves.toBeDefined();
	});

	it.each(
		files
			.filter((name) => name.endsWith(".jsonl"))
			.map((name) => [name, join(malformedDir, name)] as const),
	)("LSA-NR06 %s cohere does not throw", async (_name, path) => {
		await expect(assembleMalformed(path, "jsonl", cohereAdapter())).resolves.toBeDefined();
	});

	it.each(
		files
			.filter((name) => name.endsWith(".jsonl"))
			.map((name) => [name, join(malformedDir, name)] as const),
	)("LSA-NR07 %s bedrock does not throw", async (_name, path) => {
		await expect(assembleMalformed(path, "jsonl", bedrockAdapter())).resolves.toBeDefined();
	});

	it("LSA-NR08: openai-compatible malformed sse does not throw", async () => {
		const path = join(malformedDir, "invalid-data-line.sse");
		await expect(assembleMalformed(path, "sse", openaiCompatibleAdapter())).resolves.toBeDefined();
	});

	it("LSA-NR09: empty malformed file yields zero or more events without throw", async () => {
		const path = join(malformedDir, "empty-file.sse");
		const events = await assembleMalformed(path, "sse", openaiChatAdapter());
		expect(Array.isArray(events)).toBe(true);
	});

	it("LSA-NR10: truncated-json malformed anthropic does not throw", async () => {
		const path = join(malformedDir, "truncated-json.sse");
		await expect(assembleMalformed(path, "sse", anthropicAdapter())).resolves.toBeDefined();
	});

	it("LSA-NR21: malformed fixture directory has at least 25 files", () => {
		expect(files.length).toBeGreaterThanOrEqual(25);
	});

	it("LSA-NR22: newly added malformed fixtures are present", () => {
		for (const name of [
			"comment-only.sse",
			"done-with-tail.sse",
			"cohere-truncated-line.jsonl",
			"bedrock-nonjson-line.jsonl",
			"jsonl-missing-brace.jsonl",
		]) {
			expect(files).toContain(name);
		}
	});

	const sseAdapters = [
		{ name: "openai-chat", create: () => openaiChatAdapter() },
		{ name: "anthropic", create: () => anthropicAdapter() },
		{ name: "openai-responses", create: () => openaiResponsesAdapter() },
		{ name: "gemini", create: () => geminiAdapter() },
		{ name: "openai-compatible", create: () => openaiCompatibleAdapter() },
	] as const;
	const jsonlAdapters = [
		{ name: "openai-chat", create: () => openaiChatAdapter() },
		{ name: "cohere", create: () => cohereAdapter() },
		{ name: "bedrock", create: () => bedrockAdapter() },
	] as const;
	const nrRows: Array<{
		id: string;
		file: string;
		adapter: string;
		transport: "sse" | "jsonl";
		assemble: () => Promise<unknown[]>;
	}> = [];
	for (const file of [...files].sort()) {
		const transport = file.endsWith(".jsonl") ? "jsonl" : "sse";
		const adapters = transport === "sse" ? sseAdapters : jsonlAdapters;
		for (const adapter of adapters) {
			if (nrRows.length >= 28) break;
			const path = join(malformedDir, file);
			nrRows.push({
				id: `LSA-NR${23 + nrRows.length}`,
				file,
				adapter: adapter.name,
				transport,
				assemble: () => assembleMalformed(path, transport, adapter.create()),
			});
		}
		if (nrRows.length >= 28) break;
	}

	it("LSA-NR22b: NR23-NR50 matrix contains 28 adapter/file rows", () => {
		expect(nrRows).toHaveLength(28);
		expect(nrRows.at(0)?.id).toBe("LSA-NR23");
		expect(nrRows.at(-1)?.id).toBe("LSA-NR50");
	});

	it.each(nrRows)("$id $adapter $file does not throw", async ({ assemble }) => {
		await expect(assemble()).resolves.toBeDefined();
	});
});
