import type { AssembleOptions, StreamAdapter, StreamEvent } from "./types";
import { assembleFromPayloads } from "./assemble-payloads";
import { parseSSE } from "./parse-sse";

export function assembleStream(
	source: ReadableStream<Uint8Array> | AsyncIterable<string>,
	adapter: StreamAdapter,
	options?: AssembleOptions,
): AsyncIterable<StreamEvent> {
	return assembleFromPayloads(parseSSE(source), adapter, options);
}
