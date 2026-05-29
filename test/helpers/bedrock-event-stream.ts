export function chunkBytes(bytes: Uint8Array, chunkSize: number): Uint8Array[] {
	if (chunkSize <= 0) return [bytes];
	const chunks: Uint8Array[] = [];
	for (let offset = 0; offset < bytes.length; offset += chunkSize) {
		chunks.push(bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length)));
	}
	return chunks;
}

export function readableFromChunks(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
	return new ReadableStream<Uint8Array>({
		start(controller) {
			for (const chunk of chunks) controller.enqueue(chunk);
			controller.close();
		},
	});
}

export function corruptPreludeCrc(bytes: Uint8Array): Uint8Array {
	const copy = bytes.slice();
	copy[9] ^= 0xff;
	return copy;
}

export function corruptMessageCrc(bytes: Uint8Array): Uint8Array {
	const copy = bytes.slice();
	const lastIndex = copy.length - 1;
	copy[lastIndex] ^= 0xff;
	return copy;
}
