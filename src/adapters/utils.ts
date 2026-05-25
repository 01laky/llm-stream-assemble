/** Internal adapter utilities. Not part of the public API. */
import type { RawChunk } from "../core/types";

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function asString(value: unknown): string | undefined {
	return typeof value === "string" ? value : undefined;
}

export function asNumber(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function optionalRawChunk(input: Record<string, unknown>): RawChunk {
	return Object.fromEntries(
		Object.entries(input).filter(([, value]) => value !== undefined),
	) as RawChunk;
}

export function prefixedAdapterError(feature: string, message: string): Error {
	return new Error(`llm-stream-assemble: ${feature}: ${message}`);
}

export function parseAdapterJSON(raw: string, feature: string): unknown {
	try {
		return JSON.parse(raw) as unknown;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw prefixedAdapterError(feature, message);
	}
}
