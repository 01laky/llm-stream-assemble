import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { anthropicAdapter } from "../src/adapters/anthropic";
import { runAdapterGoldenStream } from "./helpers/adapter-conformance";
import { expectedAnthropicEvents, normalizeAnthropicEvents } from "./helpers/anthropic-fixtures";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures/anthropic");

describe("anthropicAdapter shared conformance harness", () => {
	it("LSA-A26: runAdapterGoldenStream parity for text-basic and tool-use SSE fixtures", async () => {
		for (const name of ["text-basic", "tool-use"] as const) {
			const events = normalizeAnthropicEvents(
				(await runAdapterGoldenStream({
					adapter: anthropicAdapter(),
					fixtureSsePath: join(fixturesDir, `${name}.sse`),
					expectedEventsPath: join(fixturesDir, `${name}.expected.json`),
				})) as never[],
			);
			expect(events).toEqual(expectedAnthropicEvents(name));
		}
	});
});
