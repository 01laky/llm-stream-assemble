import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { StreamEvent } from "../../src/core/types";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "../fixtures/gemini");

export function geminiTextFixture(name: string, extension: string): string {
	return readFileSync(join(fixturesDir, `${name}.${extension}`), "utf8");
}

export function geminiJSONFixture(name: string): unknown {
	return JSON.parse(geminiTextFixture(name, "json")) as unknown;
}

export function expectedGeminiEvents(name: string): unknown {
	return JSON.parse(geminiTextFixture(name, "expected.json")) as unknown;
}

export function normalizeGeminiEvents(events: StreamEvent[]): unknown[] {
	return events.map((event) => {
		if (event.type === "metadata") {
			const { raw: _raw, ...rest } = event;
			return rest;
		}
		if (event.type === "usage") {
			const { raw: _raw, ...rest } = event;
			return rest;
		}
		if (event.type === "error") {
			return { type: "error", recoverable: event.recoverable };
		}
		return event;
	});
}
