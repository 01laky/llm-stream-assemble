import { sourceToStrings } from "./utils/source";
import { SSEParser } from "./utils/sse-parser";

export function parseSSE(
	source: ReadableStream<Uint8Array> | AsyncIterable<string>,
): AsyncIterable<string> {
	return parseSSEGenerator(source);
}

async function* parseSSEGenerator(
	source: ReadableStream<Uint8Array> | AsyncIterable<string>,
): AsyncIterable<string> {
	const parser = new SSEParser();

	for await (const chunk of sourceToStrings(source)) {
		for (const payload of parser.push(chunk)) {
			yield payload;
		}
	}

	for (const payload of parser.flush()) {
		yield payload;
	}
}
