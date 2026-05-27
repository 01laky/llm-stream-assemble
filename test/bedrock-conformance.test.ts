import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { bedrockAdapter } from "../src/adapters/bedrock";
import { runAdapterGoldenStream } from "./helpers/adapter-conformance";
import { expectedBedrockEvents, normalizeBedrockEvents } from "./helpers/bedrock-fixtures";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures/bedrock");

describe("bedrockAdapter shared conformance harness", () => {
	it("LSA-B59: runAdapterGoldenStream parity for text-basic and tool-single SSE fixtures", async () => {
		for (const name of ["text-basic", "tool-single"] as const) {
			const events = normalizeBedrockEvents(
				await runAdapterGoldenStream({
					adapter: bedrockAdapter(),
					fixtureSsePath: join(fixturesDir, `${name}.sse`),
					expectedEventsPath: join(fixturesDir, `${name}.expected.json`),
				}),
			);
			expect(events).toEqual(expectedBedrockEvents(name));
		}
	});
});
