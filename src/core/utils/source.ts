import { Utf8StreamDecoder } from "./bytes";

export async function* readableStreamToStrings(
	source: ReadableStream<Uint8Array>,
): AsyncIterable<string> {
	const reader = source.getReader();
	const decoder = new Utf8StreamDecoder();
	let completed = false;

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) {
				completed = true;
				break;
			}
			const decoded = decoder.decode(value);
			if (decoded.length > 0) {
				yield decoded;
			}
		}

		const flushed = decoder.flush();
		if (flushed.length > 0) {
			yield flushed;
		}
	} finally {
		if (!completed) {
			await reader.cancel().catch(() => undefined);
		}
		reader.releaseLock();
	}
}

export function isReadableStream(
	source: ReadableStream<Uint8Array> | AsyncIterable<string>,
): source is ReadableStream<Uint8Array> {
	return typeof (source as ReadableStream<Uint8Array>).getReader === "function";
}

export function sourceToStrings(
	source: ReadableStream<Uint8Array> | AsyncIterable<string>,
): AsyncIterable<string> {
	return isReadableStream(source) ? readableStreamToStrings(source) : source;
}

export function errorFromUnknown(error: unknown): Error {
	return error instanceof Error ? error : new Error(String(error));
}

export function prefixedError(message: string): Error {
	return new Error(`llm-stream-assemble: ${message}`);
}
