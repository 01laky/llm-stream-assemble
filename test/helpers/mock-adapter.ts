import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import type { RawChunk, StreamAdapter } from "../../src/core/types";

interface FixtureDefinition {
	payloads?: Record<string, RawChunk[]>;
	sequence?: RawChunk[][];
	response?: RawChunk[];
}

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "../..");

export function mockAdapter(chunksByPayload: Record<string, RawChunk[]>): StreamAdapter {
	return {
		parseChunk(raw) {
			const chunks = chunksByPayload[raw];
			if (!chunks) {
				throw new Error(`unexpected payload: ${raw}`);
			}
			return chunks;
		},
	};
}

export function sequenceMockAdapter(sequence: RawChunk[][], response?: RawChunk[]): StreamAdapter {
	let index = 0;
	const adapter: StreamAdapter = {
		parseChunk() {
			const chunks = sequence[index];
			index += 1;
			if (!chunks) {
				throw new Error(`unexpected payload at index ${index - 1}`);
			}
			return chunks;
		},
	};
	if (response) {
		adapter.parseResponse = () => response;
	}
	return adapter;
}

export function mockAdapterFromFixture(name: string): StreamAdapter {
	const definition = JSON.parse(
		readFileSync(join(rootDir, "test/fixtures/core", `${name}.chunks.json`), "utf8"),
	) as FixtureDefinition;

	if (definition.sequence) {
		return sequenceMockAdapter(definition.sequence, definition.response);
	}

	const adapter: StreamAdapter = {
		parseChunk(raw) {
			const chunks = definition.payloads?.[raw];
			if (!chunks) {
				throw new Error(`unexpected payload: ${raw}`);
			}
			return chunks;
		},
	};
	if (definition.response) {
		adapter.parseResponse = () => definition.response ?? [];
	}
	return adapter;
}
