import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { cohereAdapter } from "../src/adapters/cohere";
import { runAdapterGoldenStream } from "./helpers/adapter-conformance";
import { expectedCohereEvents, normalizeCohereEvents } from "./helpers/cohere-fixtures";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures/cohere");

describe("cohereAdapter shared conformance harness", () => {
	it("LSA-CO59: runAdapterGoldenStream parity for text-basic and tool-single SSE fixtures", async () => {
		for (const name of ["text-basic", "tool-single"] as const) {
			const events = normalizeCohereEvents(
				await runAdapterGoldenStream({
					adapter: cohereAdapter(),
					fixtureSsePath: join(fixturesDir, `${name}.sse`),
					expectedEventsPath: join(fixturesDir, `${name}.expected.json`),
				}),
			);
			expect(events).toEqual(expectedCohereEvents(name));
		}
	});
});
