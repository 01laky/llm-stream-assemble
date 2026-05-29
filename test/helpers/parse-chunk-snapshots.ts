import type { RawChunk } from "../../src/core/types";

export type SnapshotChunk = Record<string, unknown>;

export function normalizeRawChunks(chunks: RawChunk[]): SnapshotChunk[] {
	const normalized = chunks.map((chunk, index) => {
		const clean = stripUndefinedDeep(chunk) as SnapshotChunk;
		return {
			index,
			key: stableSortKey(clean),
			chunk: clean,
		};
	});
	normalized.sort((a, b) => {
		if (a.key < b.key) return -1;
		if (a.key > b.key) return 1;
		return a.index - b.index;
	});
	return normalized.map((entry) => entry.chunk);
}

function stableSortKey(value: unknown): string {
	return JSON.stringify(canonicalize(value));
}

function canonicalize(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map((item) => canonicalize(item));
	}
	if (!isRecord(value)) return value;
	const keys = Object.keys(value).sort();
	const output: Record<string, unknown> = {};
	for (const key of keys) {
		output[key] = canonicalize(value[key]);
	}
	return output;
}

function stripUndefinedDeep(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map((item) => stripUndefinedDeep(item)).filter((item) => item !== undefined);
	}
	if (!isRecord(value)) return value;
	const output: Record<string, unknown> = {};
	for (const [key, nested] of Object.entries(value)) {
		if (nested === undefined) continue;
		output[key] = stripUndefinedDeep(nested);
	}
	return output;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
