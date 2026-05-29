import type { StreamAdapter } from "../../core/types";
import { createStreamAdapter } from "../utils";
import { parseResponse } from "./parse-response";
import { ResponsesParser } from "./stream-parser";
import type { OpenAIResponsesAdapterOptions } from "./types";

export type { OpenAIResponsesAdapterOptions } from "./types";

export function openaiResponsesAdapter(options: OpenAIResponsesAdapterOptions = {}): StreamAdapter {
	const parser = new ResponsesParser(options);
	return createStreamAdapter({
		parser,
		parseResponse,
		options,
	});
}
