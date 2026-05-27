import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { openaiResponsesAdapter } from "../src/adapters/openai-responses";
import { runAdapterGoldenStream } from "./helpers/adapter-conformance";
import { readExpectedEvents } from "./helpers/adapter-conformance";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures/openai-responses");

function normalizeResponsesEvents(events: unknown[]): unknown[] {
	return events.map((event) => {
		if (typeof event !== "object" || event === null) return event;
		const record = event as Record<string, unknown>;
		if (record.type === "metadata") {
			const { raw: _raw, ...rest } = record;
			return rest;
		}
		if (record.type === "usage") {
			const { raw: _raw, ...rest } = record;
			return rest;
		}
		if (record.type === "error") {
			return { type: "error", recoverable: record.recoverable };
		}
		return event;
	});
}

describe("openaiResponsesAdapter shared conformance harness", () => {
	it("LSA-R32: runAdapterGoldenStream parity for text-basic and function-call SSE fixtures", async () => {
		for (const name of ["text-basic", "function-call"] as const) {
			const events = normalizeResponsesEvents(
				await runAdapterGoldenStream({
					adapter: openaiResponsesAdapter(),
					fixtureSsePath: join(fixturesDir, `${name}.sse`),
					expectedEventsPath: join(fixturesDir, `${name}.expected.json`),
				}),
			);
			expect(events).toEqual(readExpectedEvents(join(fixturesDir, `${name}.expected.json`)));
		}
	});
});
