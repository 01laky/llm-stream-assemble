import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { openaiChatAdapter } from "../src/adapters/openai-chat";
import { assembleFromPayloads } from "../src/core/assemble-payloads";
import { AssemblySession } from "../src/core/assembly/session";
import { createAssemblyTransform } from "../src/core/create-assembly-transform";
import { createAdapterForEntry, discoverEdgeCatalogFixtures } from "./helpers/fixture-catalog";
import { loadGoldenExpected, normalizeForAdapterKey } from "./helpers/golden-parity";
import { collectAsync } from "./helpers/collect-events";

async function collectReadable<T>(readable: ReadableStream<T>): Promise<T[]> {
	const reader = readable.getReader();
	const items: T[] = [];
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		items.push(value);
	}
	return items;
}

function oaiPayload(delta: Record<string, unknown>, finish: string | null = null): string {
	return JSON.stringify({
		id: "as_test",
		object: "chat.completion.chunk",
		choices: [{ index: 0, delta, finish_reason: finish }],
	});
}

function ssePayloadsFromFile(path: string): string[] {
	return readFileSync(path, "utf8")
		.split("\n")
		.filter((line) => line.startsWith("data: "))
		.map((line) => line.slice(6).trim())
		.filter((line) => line.length > 0);
}

describe("AssemblySession edge cases", () => {
	it("LSA-AS01: [DONE] payload yields no events; terminal flush emits stop finish", () => {
		const session = AssemblySession.create(openaiChatAdapter());
		expect(session.handlePayload("[DONE]")).toEqual([]);
		expect(session.terminalFlush()).toContainEqual({ type: "finish", reason: "stop" });
	});

	it("LSA-AS02: markAborted short-circuits further payloads to aborted terminal flush", () => {
		const session = AssemblySession.create(openaiChatAdapter());
		session.handlePayload(oaiPayload({ role: "assistant", content: "x" }));
		session.markAborted();
		const flushed = session.handlePayload(oaiPayload({ content: "late" }));
		expect(flushed.some((event) => event.type === "finish" && event.reason === "aborted")).toBe(
			true,
		);
		expect(session.isAborted()).toBe(true);
	});

	it("LSA-AS03: pre-aborted AbortSignal is treated as aborted before payloads", () => {
		const controller = new AbortController();
		controller.abort();
		const session = AssemblySession.create(openaiChatAdapter(), { signal: controller.signal });
		expect(session.isAborted()).toBe(true);
		const events = session.handlePayload(oaiPayload({ content: "ignored" }));
		expect(events.some((event) => event.type === "finish" && event.reason === "aborted")).toBe(
			true,
		);
	});

	it("LSA-AS04: recoverMalformed emits recoverable error events without throwing", () => {
		const session = AssemblySession.create(
			{
				parseChunk() {
					throw new SyntaxError("bad json");
				},
			},
			{ recoverMalformed: true },
		);
		const events = session.handlePayload("not-json");
		expect(events).toEqual([
			{
				type: "error",
				error: expect.objectContaining({ message: expect.stringContaining("bad json") }),
				recoverable: true,
			},
		]);
		expect(session.terminalFlush()).toContainEqual({ type: "finish", reason: "incomplete" });
	});

	it("LSA-AS05: incomplete stream without [DONE] flushes with incomplete reason", () => {
		const session = AssemblySession.create(openaiChatAdapter());
		session.handlePayload(oaiPayload({ role: "assistant", content: "partial" }));
		expect(session.terminalFlush()).toContainEqual({ type: "finish", reason: "incomplete" });
	});

	it("LSA-AS06: assembleFromPayloads and golden parity agree on ec01 payloads", async () => {
		const entry = discoverEdgeCatalogFixtures().find(
			(row) => row.id === "edge-catalog/ec01-sse-midline-split.sse",
		);
		expect(entry).toBeDefined();
		const fromPayloads = normalizeForAdapterKey(
			entry!.adapterKey,
			await collectAsync(
				assembleFromPayloads(
					(async function* () {
						for (const payload of ssePayloadsFromFile(entry!.streamPath)) {
							yield payload;
						}
					})(),
					createAdapterForEntry(entry!),
				),
			),
		);
		expect(fromPayloads).toEqual(loadGoldenExpected(entry!.expectedPath));
	});

	it("LSA-AS07: createAssemblyTransform abort signal terminates with aborted finish", async () => {
		const controller = new AbortController();
		const transform = createAssemblyTransform(openaiChatAdapter(), { signal: controller.signal });
		const collected = collectReadable(transform.readable);
		const writer = transform.writable.getWriter();
		await writer.write(
			new TextEncoder().encode(
				'data: {"choices":[{"index":0,"delta":{"role":"assistant","content":"x"}}]}\n\n',
			),
		);
		controller.abort();
		await writer.close();
		const events = await collected;
		expect(events.some((event) => event.type === "finish" && event.reason === "aborted")).toBe(
			true,
		);
	});

	it("LSA-AS08: assembleFromPayloads matches golden for ec78 responses refusal", async () => {
		const entry = discoverEdgeCatalogFixtures().find(
			(row) => row.id === "edge-catalog/ec78-responses-refusal.sse",
		);
		expect(entry).toBeDefined();
		const fromPayloads = normalizeForAdapterKey(
			entry!.adapterKey,
			await collectAsync(
				assembleFromPayloads(
					(async function* () {
						for (const payload of ssePayloadsFromFile(entry!.streamPath)) {
							yield payload;
						}
					})(),
					createAdapterForEntry(entry!),
				),
			),
		);
		expect(fromPayloads).toEqual(loadGoldenExpected(entry!.expectedPath));
	});
});
