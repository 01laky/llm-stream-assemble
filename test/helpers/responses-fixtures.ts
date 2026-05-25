import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { RawChunk, StreamEvent } from "../../src/core/types";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "../fixtures/openai-responses");

export function responsesTextFixture(name: string, extension: string): string {
	return readFileSync(join(fixturesDir, `${name}.${extension}`), "utf8");
}

export function responsesJSONFixture(name: string): unknown {
	return JSON.parse(responsesTextFixture(name, "json")) as unknown;
}

export function expectedResponsesEvents(name: string): unknown {
	return JSON.parse(responsesTextFixture(name, "expected.json")) as unknown;
}

export function normalizeResponsesEvents(events: StreamEvent[]): unknown[] {
	return events.map((event) => {
		if (event.type === "metadata") {
			const { raw: _raw, ...rest } = event;
			return rest;
		}
		if (event.type === "usage") {
			const { raw: _raw, ...rest } = event;
			return rest;
		}
		if (event.type === "error") return { type: "error", recoverable: event.recoverable };
		return event;
	});
}

export function normalizeResponsesRawChunks(chunks: RawChunk[]): unknown[] {
	return chunks.map((chunk) => {
		if (chunk.kind === "metadata") {
			const { raw: _raw, ...rest } = chunk;
			return rest;
		}
		if (chunk.kind === "usage") {
			const { raw: _raw, ...rest } = chunk;
			return rest;
		}
		if (chunk.kind === "provider-error")
			return { kind: "provider-error", recoverable: chunk.recoverable };
		return chunk;
	});
}
