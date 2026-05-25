import type { StreamAdapter } from "../../../core/types";
import { createStreamAdapter } from "../../utils";
import { OpenAIChatLikeParser } from "./stream-parser";
import { parseResponse } from "./response";
import { normalizeOptions, type OpenAIChatLikeParserOptions } from "./types";

export type { OpenAIChatLikeParserOptions } from "./types";

export function createOpenAIChatLikeAdapter(options: OpenAIChatLikeParserOptions): StreamAdapter {
	const normalized = normalizeOptions(options);
	const parser = new OpenAIChatLikeParser(normalized);
	return createStreamAdapter({
		parser,
		parseResponse,
		options: normalized,
	});
}
