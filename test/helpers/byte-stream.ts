const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function byteStreamFromSplitString(
	source: string,
	chunkSize: number,
): ReadableStream<Uint8Array> {
	const bytes = encoder.encode(source);
	if (chunkSize <= 0 || chunkSize >= bytes.length) {
		return new ReadableStream<Uint8Array>({
			start(controller) {
				if (bytes.length > 0) controller.enqueue(bytes);
				controller.close();
			},
		});
	}
	let offset = 0;
	return new ReadableStream<Uint8Array>({
		pull(controller) {
			if (offset >= bytes.length) {
				controller.close();
				return;
			}
			const end = Math.min(offset + chunkSize, bytes.length);
			controller.enqueue(bytes.subarray(offset, end));
			offset = end;
		},
	});
}

export async function readStreamToString(stream: ReadableStream<Uint8Array>): Promise<string> {
	const reader = stream.getReader();
	let result = "";
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		result += decoder.decode(value, { stream: true });
	}
	result += decoder.decode();
	return result;
}

export async function* jsonlLinesFromByteStream(
	source: ReadableStream<Uint8Array>,
): AsyncIterable<string> {
	let buffer = "";
	for await (const chunk of streamChunks(source)) {
		buffer += decoder.decode(chunk, { stream: true });
		let newlineIndex = buffer.indexOf("\n");
		while (newlineIndex !== -1) {
			const line = buffer.slice(0, newlineIndex).replace(/\r$/, "").trim();
			buffer = buffer.slice(newlineIndex + 1);
			if (line.length > 0) yield line;
			newlineIndex = buffer.indexOf("\n");
		}
	}
	buffer += decoder.decode();
	const tail = buffer.replace(/\r$/, "").trim();
	if (tail.length > 0) yield tail;
}

async function* streamChunks(
	source: ReadableStream<Uint8Array>,
): AsyncGenerator<Uint8Array, void, unknown> {
	const reader = source.getReader();
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			if (value) yield value;
		}
	} finally {
		reader.releaseLock();
	}
}

export function evilOffsetChunkSizes(byteLength: number): number[] {
	if (byteLength <= 1) return [1];
	const sizes = new Set<number>([
		Math.floor(byteLength / 2),
		Math.floor(byteLength / 3),
		byteLength - 1,
	]);
	return [...sizes].filter((size) => size >= 1).sort((a, b) => a - b);
}
