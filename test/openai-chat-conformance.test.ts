import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { openaiChatAdapter } from "../src/adapters/openai-chat";
import { runAdapterGoldenStream } from "./helpers/adapter-conformance";
import { expectedOpenAIEvents, normalizeEvents } from "./helpers/openai-fixtures";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures/openai-chat");

describe("openaiChatAdapter shared conformance harness", () => {
	it("LSA-OC253: runAdapterGoldenStream parity for text-basic and tool-single", async () => {
		for (const name of ["text-basic", "tool-single"] as const) {
			const events = normalizeEvents(
				await runAdapterGoldenStream({
					adapter: openaiChatAdapter(),
					fixtureSsePath: join(fixturesDir, `${name}.sse`),
					expectedEventsPath: join(fixturesDir, `${name}.expected.json`),
				}),
			);
			expect(events).toEqual(expectedOpenAIEvents(name));
		}
	});

	it("LSA-OC254: runAdapterGoldenStream parity for refusal.sse", async () => {
		const events = normalizeEvents(
			await runAdapterGoldenStream({
				adapter: openaiChatAdapter(),
				fixtureSsePath: join(fixturesDir, "refusal.sse"),
				expectedEventsPath: join(fixturesDir, "refusal.expected.json"),
			}),
		);
		expect(events).toEqual(expectedOpenAIEvents("refusal"));
	});

	it("LSA-OC255: runAdapterGoldenStream parity for json-mode with jsonMode option", async () => {
		const events = normalizeEvents(
			await runAdapterGoldenStream({
				adapter: openaiChatAdapter({ jsonMode: true }),
				fixtureSsePath: join(fixturesDir, "json-mode.sse"),
				expectedEventsPath: join(fixturesDir, "json-mode.expected.json"),
			}),
		);
		expect(events).toEqual(expectedOpenAIEvents("json-mode"));
	});
});
