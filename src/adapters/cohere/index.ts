import type { StreamAdapter } from "../../core/types";
import { createStreamAdapter } from "../utils";
import { parseResponse } from "./parse-response";
import { CohereStreamParser } from "./stream-parser";
import type { CohereAdapterOptions } from "./types";

export type { CohereAdapterOptions } from "./types";

export function cohereAdapter(options: CohereAdapterOptions = {}): StreamAdapter {
	const parser = new CohereStreamParser(options);
	return createStreamAdapter({
		parser,
		parseResponse,
		options,
	});
}
