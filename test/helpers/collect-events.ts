export async function collectAsync<T>(iterable: AsyncIterable<T>): Promise<T[]> {
	const items: T[] = [];
	for await (const item of iterable) {
		items.push(item);
	}
	return items;
}

export async function* strings(...chunks: string[]): AsyncIterable<string> {
	for (const chunk of chunks) {
		yield chunk;
	}
}

export function byteStreamFromStrings(...chunks: string[]): ReadableStream<Uint8Array> {
	const encoder = new TextEncoder();
	return new ReadableStream<Uint8Array>({
		start(controller) {
			for (const chunk of chunks) {
				controller.enqueue(encoder.encode(chunk));
			}
			controller.close();
		},
	});
}
