/**
 * Minimal zero-dep AWS Bedrock EventStream decoder (examples only — not production-grade).
 * Production apps may prefer the AWS SDK eventstream handler or SDK ConverseStream helpers.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { assembleFromPayloads, bedrockAdapter } from "../../src/index";

const HEADER_VALUE_STRING = 7;

function crc32(bytes: Uint8Array): number {
	let crc = 0xffffffff;
	for (const byte of bytes) {
		crc ^= byte;
		for (let bit = 0; bit < 8; bit += 1) {
			const mask = -(crc & 1);
			crc = (crc >>> 1) ^ (0xedb88320 & mask);
		}
	}
	return (crc ^ 0xffffffff) >>> 0;
}

function writeU32(view: DataView, offset: number, value: number): void {
	view.setUint32(offset, value, false);
}

function readU32(view: DataView, offset: number): number {
	return view.getUint32(offset, false);
}

function encodeHeader(name: string, value: string): Uint8Array {
	const nameBytes = new TextEncoder().encode(name);
	const valueBytes = new TextEncoder().encode(value);
	const out = new Uint8Array(1 + nameBytes.length + 1 + 2 + valueBytes.length);
	const view = new DataView(out.buffer);
	let offset = 0;
	out[offset] = nameBytes.length;
	offset += 1;
	out.set(nameBytes, offset);
	offset += nameBytes.length;
	out[offset] = HEADER_VALUE_STRING;
	offset += 1;
	view.setUint16(offset, valueBytes.length, false);
	offset += 2;
	out.set(valueBytes, offset);
	return out;
}

/** Encode one JSON payload as an AWS EventStream message (for synthetic fixtures). */
export function encodeBedrockEventStreamMessage(payloadJson: string): Uint8Array {
	const payloadBytes = new TextEncoder().encode(payloadJson);
	const headers = concatBytes([
		encodeHeader(":content-type", "application/json"),
		encodeHeader(":message-type", "event"),
	]);
	const headersLength = headers.length;
	const payloadLength = payloadBytes.length;
	const totalLength = 12 + headersLength + payloadLength + 4;
	const message = new Uint8Array(totalLength);
	const view = new DataView(message.buffer);
	writeU32(view, 0, totalLength);
	writeU32(view, 4, headersLength);
	const preludeCrc = crc32(message.subarray(0, 8));
	writeU32(view, 8, preludeCrc);
	message.set(headers, 12);
	message.set(payloadBytes, 12 + headersLength);
	const messageCrc = crc32(message.subarray(0, totalLength - 4));
	writeU32(view, totalLength - 4, messageCrc);
	return message;
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
	const total = parts.reduce((sum, part) => sum + part.length, 0);
	const out = new Uint8Array(total);
	let offset = 0;
	for (const part of parts) {
		out.set(part, offset);
		offset += part.length;
	}
	return out;
}

/** Decode a Bedrock ConverseStream binary body into UTF-8 JSON payload strings (one per event). */
export function decodeBedrockEventStreamBytes(bytes: Uint8Array): string[] {
	const payloads: string[] = [];
	let offset = 0;
	while (offset + 16 <= bytes.length) {
		const view = new DataView(bytes.buffer, bytes.byteOffset + offset, bytes.length - offset);
		const totalLength = readU32(view, 0);
		if (totalLength < 16 || offset + totalLength > bytes.length) break;

		const message = bytes.subarray(offset, offset + totalLength);
		const preludeCrc = readU32(view, 8);
		if (crc32(message.subarray(0, 8)) !== preludeCrc) {
			throw new Error("EventStream prelude CRC mismatch");
		}
		const messageCrc = readU32(view, totalLength - 4);
		if (crc32(message.subarray(0, totalLength - 4)) !== messageCrc) {
			throw new Error("EventStream message CRC mismatch");
		}

		const headersLength = readU32(view, 4);
		const payloadStart = 12 + headersLength;
		const payloadEnd = totalLength - 4;
		const payloadBytes = message.subarray(payloadStart, payloadEnd);
		payloads.push(new TextDecoder().decode(payloadBytes));
		offset += totalLength;
	}
	return payloads;
}

/** Async generator over decoded payloads from a ReadableStream (for Worker/fetch paths). */
export async function* decodedBedrockEventPayloads(
	stream: ReadableStream<Uint8Array>,
): AsyncGenerator<string> {
	const reader = stream.getReader();
	const chunks: Uint8Array[] = [];
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			if (value) chunks.push(value);
		}
	} finally {
		reader.releaseLock();
	}
	const merged = concatBytes(chunks);
	for (const payload of decodeBedrockEventStreamBytes(merged)) {
		yield payload;
	}
}

export async function runDecodeEventStreamExample(
	options: { write?: (text: string) => void; fixturePath?: string } = {},
): Promise<void> {
	const write = options.write ?? ((text: string) => process.stdout.write(text));
	const fixturePath =
		options.fixturePath ??
		join(
			dirname(fileURLToPath(import.meta.url)),
			"../../test/fixtures/bedrock/event-stream-bytes.bin",
		);
	const bytes = new Uint8Array(readFileSync(fixturePath));
	const payloads = decodeBedrockEventStreamBytes(bytes);

	async function* iterable() {
		for (const payload of payloads) yield payload;
	}

	for await (const event of assembleFromPayloads(iterable(), bedrockAdapter())) {
		write(`${event.type}\n`);
	}
}
