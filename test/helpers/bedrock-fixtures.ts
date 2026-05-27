import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { StreamEvent } from "../../src/core/types";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "../fixtures/bedrock");

export function bedrockTextFixture(name: string, extension: string): string {
	return readFileSync(join(fixturesDir, `${name}.${extension}`), "utf8");
}

export function bedrockJsonlLines(name: string): string[] {
	return bedrockTextFixture(name, "jsonl")
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.length > 0);
}

export function bedrockJSONFixture(name: string): unknown {
	return JSON.parse(bedrockTextFixture(name, "json")) as unknown;
}

export function bedrockBinaryFixture(name: string): Uint8Array {
	return new Uint8Array(readFileSync(join(fixturesDir, `${name}.bin`)));
}

export function expectedBedrockEvents(name: string): unknown {
	return JSON.parse(bedrockTextFixture(name, "expected.json")) as unknown;
}

export function normalizeBedrockEvents(events: StreamEvent[]): unknown[] {
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
		if (event.type === "tool_call.args.delta") {
			const { partial: _partial, ...rest } = event;
			return rest;
		}
		return event;
	});
}
