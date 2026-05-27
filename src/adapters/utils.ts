/** Internal adapter utilities. Not part of the public API. */
import type { RawChunk, StreamAdapter } from "../core/types";
import { stripUndefined } from "../core/utils/object";
import { adapterScopedError } from "./errors";

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
	return stripUndefined(input) as RawChunk;
}

export function prefixedAdapterError(feature: string, message: string): Error {
	return adapterScopedError(feature, message);
}

export function createStreamAdapter<TOptions>(config: {
	parser: { parseChunk(raw: string): RawChunk[] };
	parseResponse: (body: unknown, options: TOptions) => RawChunk[];
	options: TOptions;
}): StreamAdapter {
	return {
		parseChunk(raw) {
			return config.parser.parseChunk(raw);
		},
		parseResponse(body) {
			return config.parseResponse(body, config.options);
		},
	};
}

export function parseAdapterJSON(raw: string, feature: string): unknown {
	try {
		return JSON.parse(raw) as unknown;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw prefixedAdapterError(feature, message);
	}
}
