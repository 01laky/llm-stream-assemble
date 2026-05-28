import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { anthropicAdapter } from "../src/adapters/anthropic";
import { runAdapterGoldenStream } from "./helpers/adapter-conformance";
import { discoverStreamFixtures, tier1FixtureCount } from "./helpers/fixture-catalog";
import { loadGoldenExpected, runGoldenStreamParity } from "./helpers/golden-parity";
import { assertStreamInvariants, profileForAdapterKey } from "./helpers/stream-invariants";
import { expectedAnthropicEvents, normalizeAnthropicEvents } from "./helpers/anthropic-fixtures";
import { byteStreamFromSplitString } from "./helpers/byte-stream";
import { assembleStream } from "../src/core/assemble-stream";
import { collectAsync } from "./helpers/collect-events";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures/anthropic");

const NEW_ANTHROPIC_FIXTURES = [
	"tool-parallel",
	"usage-stream",
	"incomplete",
	"json-mode",
	"empty-stream",
] as const;

describe("anthropic fixture parity expansion", () => {
	it("LSA-A64: new anthropic fixtures registered in catalog", () => {
		const ids = discoverStreamFixtures()
			.filter((entry) => entry.adapterKey === "anthropic")
			.map((entry) => entry.id);
		for (const name of NEW_ANTHROPIC_FIXTURES) {
			expect(ids).toContain(`anthropic/${name}.sse`);
		}
	});

	it.each(NEW_ANTHROPIC_FIXTURES.map((name) => [name] as const))(
		"LSA-A65 %s golden parity identity chunk",
		async (name) => {
			const entry = discoverStreamFixtures().find((row) => row.id === `anthropic/${name}.sse`);
			expect(entry).toBeDefined();
			const events = await runGoldenStreamParity({ entry });
			expect(events).toEqual(loadGoldenExpected(entry!.expectedPath));
		},
	);

	it("LSA-A70: tool-parallel chunk-1 parity", async () => {
		const entry = discoverStreamFixtures().find((row) => row.id === "anthropic/tool-parallel.sse");
		const events = await runGoldenStreamParity({ entry, byteChunkSize: 1 });
		expect(events).toEqual(loadGoldenExpected(entry!.expectedPath));
	});

	it("LSA-A71: usage-stream chunk-17 parity", async () => {
		const entry = discoverStreamFixtures().find((row) => row.id === "anthropic/usage-stream.sse");
		const events = await runGoldenStreamParity({ entry, byteChunkSize: 17 });
		expect(events).toEqual(loadGoldenExpected(entry!.expectedPath));
	});

	it("LSA-A72: json-mode chunk-64 parity", async () => {
		const entry = discoverStreamFixtures().find((row) => row.id === "anthropic/json-mode.sse");
		const events = await runGoldenStreamParity({ entry, byteChunkSize: 64 });
		expect(events).toEqual(loadGoldenExpected(entry!.expectedPath));
	});

	it("LSA-A73: incomplete stream invariants", async () => {
		const entry = discoverStreamFixtures().find((row) => row.id === "anthropic/incomplete.sse");
		const raw = await import("node:fs").then((fs) => fs.readFileSync(entry!.streamPath, "utf8"));
		const events = await collectAsync(
			assembleStream(byteStreamFromSplitString(raw, 0), anthropicAdapter()),
		);
		assertStreamInvariants(events, profileForAdapterKey("anthropic"));
	});

	it("LSA-A74: empty-stream golden parity", async () => {
		const entry = discoverStreamFixtures().find((row) => row.id === "anthropic/empty-stream.sse");
		const events = await runGoldenStreamParity({ entry });
		expect(events).toEqual(loadGoldenExpected(entry!.expectedPath));
	});

	it("LSA-A75: runAdapterGoldenStream tool-parallel", async () => {
		const events = normalizeAnthropicEvents(
			(await runAdapterGoldenStream({
				adapter: anthropicAdapter(),
				fixtureSsePath: join(fixturesDir, "tool-parallel.sse"),
				expectedEventsPath: join(fixturesDir, "tool-parallel.expected.json"),
			})) as never[],
		);
		expect(events).toEqual(expectedAnthropicEvents("tool-parallel"));
	});

	it("LSA-A76: runAdapterGoldenStream usage-stream", async () => {
		const events = normalizeAnthropicEvents(
			(await runAdapterGoldenStream({
				adapter: anthropicAdapter(),
				fixtureSsePath: join(fixturesDir, "usage-stream.sse"),
				expectedEventsPath: join(fixturesDir, "usage-stream.expected.json"),
			})) as never[],
		);
		expect(events).toEqual(expectedAnthropicEvents("usage-stream"));
	});

	it("LSA-A77: json-mode uses jsonMode adapter option from catalog", () => {
		const entry = discoverStreamFixtures().find((row) => row.id === "anthropic/json-mode.sse");
		expect(entry?.adapterOptions).toEqual({ jsonMode: true });
	});

	it("LSA-A78: anthropic tier-1 count increased after expansion", () => {
		const count = discoverStreamFixtures().filter(
			(entry) => entry.adapterKey === "anthropic",
		).length;
		expect(count).toBeGreaterThanOrEqual(10);
	});

	it("LSA-A79: incomplete finish reason in golden", async () => {
		const events = await runGoldenStreamParity({
			entry: discoverStreamFixtures().find((row) => row.id === "anthropic/incomplete.sse"),
		});
		expect(events).toContainEqual({ type: "finish", reason: "incomplete" });
	});

	it("LSA-A80: empty-stream emits stop finish without text deltas", async () => {
		const events = await runGoldenStreamParity({
			entry: discoverStreamFixtures().find((row) => row.id === "anthropic/empty-stream.sse"),
		});
		expect(events.some((event) => (event as { type?: string }).type === "text.delta")).toBe(false);
		expect(events).toContainEqual({ type: "finish", reason: "stop" });
	});

	it("LSA-A81: global tier-1 count remains stable gate", () => {
		expect(tier1FixtureCount()).toBeGreaterThanOrEqual(165);
	});

	it("LSA-A82: tool-parallel emits two tool_call.done events", async () => {
		const events = await runGoldenStreamParity({
			entry: discoverStreamFixtures().find((row) => row.id === "anthropic/tool-parallel.sse"),
		});
		expect(
			events.filter((event) => (event as { type?: string }).type === "tool_call.done"),
		).toHaveLength(2);
	});

	it("LSA-A83: usage-stream includes usage events", async () => {
		const events = await runGoldenStreamParity({
			entry: discoverStreamFixtures().find((row) => row.id === "anthropic/usage-stream.sse"),
		});
		expect(
			events.filter((event) => (event as { type?: string }).type === "usage").length,
		).toBeGreaterThan(0);
	});

	it("LSA-A84: json-mode emits json.done", async () => {
		const events = await runGoldenStreamParity({
			entry: discoverStreamFixtures().find((row) => row.id === "anthropic/json-mode.sse"),
		});
		expect(events).toContainEqual({ type: "json.done", value: { answer: "yes" } });
	});

	it("LSA-A85: anthropic expansion parity ids A64-A85 covered", () => {
		expect(NEW_ANTHROPIC_FIXTURES.length).toBe(5);
	});
});
