export class Utf8StreamDecoder {
	private readonly decoder = new TextDecoder();

	decode(chunk: Uint8Array): string {
		return this.decoder.decode(chunk, { stream: true });
	}

	flush(): string {
		return this.decoder.decode();
	}
}

const encoder = new TextEncoder();

export function utf8ByteLength(value: string): number {
	return encoder.encode(value).byteLength;
}
