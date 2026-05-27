import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { RawChunk, StreamEvent } from "../../src/core/types";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "../fixtures/openai-chat");

export function openAITextFixture(name: string, extension: string): string {
	return readFileSync(join(fixturesDir, `${name}.${extension}`), "utf8");
}

export function openAIJSONFixture(name: string): unknown {
	return JSON.parse(openAITextFixture(name, "json")) as unknown;
}

export function expectedOpenAIEvents(name: string): unknown {
	return JSON.parse(openAITextFixture(name, "expected.json")) as unknown;
}

export function normalizeEvents(events: StreamEvent[]): unknown[] {
	return events.map((event) => {
		const withoutDefaultChoice = removeDefaultChoiceIndex(event);
		if (event.type === "metadata") {
			const { raw: _raw, ...rest } = withoutDefaultChoice as Extract<
				StreamEvent,
				{ type: "metadata" }
			>;
			return rest;
		}
		if (event.type === "usage") {
			const { raw: _raw, ...rest } = withoutDefaultChoice as Extract<
				StreamEvent,
				{ type: "usage" }
			>;
			return rest;
		}
		if (event.type === "citation" || event.type === "grounding" || event.type === "logprob") {
			const { raw: _raw, ...rest } = withoutDefaultChoice as StreamEvent;
			return rest;
		}
		if (event.type === "error") {
			return {
				type: "error",
				recoverable: event.recoverable,
				...(event.sanitized ? { sanitized: event.sanitized } : {}),
			};
		}
		return withoutDefaultChoice;
	});
}

function removeDefaultChoiceIndex(event: StreamEvent): StreamEvent {
	if ("choiceIndex" in event && event.choiceIndex === 0) {
		const { choiceIndex: _choiceIndex, ...rest } = event;
		return rest as StreamEvent;
	}
	return event;
}

export function normalizeRawChunks(chunks: RawChunk[]): unknown[] {
	return chunks.map((chunk) => {
		if (chunk.kind === "metadata") {
			const { raw: _raw, ...rest } = chunk;
			return rest;
		}
		if (chunk.kind === "usage") {
			const { raw: _raw, ...rest } = chunk;
			return rest;
		}
		if (chunk.kind === "provider-error") {
			return { kind: "provider-error", recoverable: chunk.recoverable };
		}
		return chunk;
	});
}
