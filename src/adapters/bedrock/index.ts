import type { StreamAdapter } from "../../core/types";
import { createStreamAdapter } from "../utils";
import { parseResponse } from "./parse-response";
import { BedrockStreamParser } from "./stream-parser";
import type { BedrockAdapterOptions } from "./types";

export type { BedrockAdapterOptions, BedrockModelFamily } from "./types";

export function bedrockAdapter(options: BedrockAdapterOptions = {}): StreamAdapter {
	const parser = new BedrockStreamParser(options);
	return createStreamAdapter({
		parser,
		parseResponse,
		options,
	});
}
