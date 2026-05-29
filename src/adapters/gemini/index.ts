import type { StreamAdapter } from "../../core/types";
import { createStreamAdapter } from "../utils";
import { parseResponse } from "./parse-response";
import { GeminiStreamParser } from "./stream-parser";
import type { GeminiAdapterOptions } from "./types";

export type { GeminiAdapterOptions, GeminiApiSurface } from "./types";
export { normalizeVertexChunk } from "./vertex";

export function geminiAdapter(options: GeminiAdapterOptions = {}): StreamAdapter {
	const parser = new GeminiStreamParser(options);
	return createStreamAdapter({
		parser,
		parseResponse,
		options,
	});
}
