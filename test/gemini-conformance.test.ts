import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { geminiAdapter } from "../src/adapters/gemini";
import { runAdapterGoldenStream } from "./helpers/adapter-conformance";
import { expectedGeminiEvents, normalizeGeminiEvents } from "./helpers/gemini-fixtures";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures/gemini");

describe("geminiAdapter shared conformance harness", () => {
	it("LSA-G71: runAdapterGoldenStream parity for canonical text and tool SSE fixtures", async () => {
		for (const name of ["text-basic", "tool-single"] as const) {
			const events = normalizeGeminiEvents(
				await runAdapterGoldenStream({
					adapter: geminiAdapter(),
					fixtureSsePath: join(fixturesDir, `${name}.sse`),
					expectedEventsPath: join(fixturesDir, `${name}.expected.json`),
				}),
			);
			expect(events).toEqual(expectedGeminiEvents(name));
		}
	});
});
