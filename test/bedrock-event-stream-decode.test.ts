import { describe, expect, it } from "vitest";
import { bedrockAdapter } from "../src/adapters/bedrock";
import { assembleFromPayloads } from "../src/core/assemble-payloads";
import {
	decodeBedrockEventStreamBytes,
	decodedBedrockEventPayloads,
} from "../examples/bedrock/decode-event-stream";
import {
	bedrockBinaryFixture,
	bedrockJsonlLines,
	expectedBedrockEvents,
	normalizeBedrockEvents,
} from "./helpers/bedrock-fixtures";
import { collectAsync } from "./helpers/collect-events";
import {
	chunkBytes,
	corruptMessageCrc,
	corruptPreludeCrc,
	readableFromChunks,
} from "./helpers/bedrock-event-stream";

describe("bedrock EventStream decode helper", () => {
	it("LSA-B35: event-stream-bytes.bin decodes to same events as text-basic.jsonl", async () => {
		const payloads = decodeBedrockEventStreamBytes(bedrockBinaryFixture("event-stream-bytes"));
		expect(payloads).toEqual(bedrockJsonlLines("text-basic"));

		async function* iterable() {
			for (const payload of payloads) yield payload;
		}

		const events = normalizeBedrockEvents(
			await collectAsync(assembleFromPayloads(iterable(), bedrockAdapter())),
		);
		expect(events).toEqual(expectedBedrockEvents("text-basic"));
	});

	it("LSA-B77: decodedBedrockEventPayloads reads ReadableStream bytes", async () => {
		const bytes = bedrockBinaryFixture("event-stream-bytes");
		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(bytes);
				controller.close();
			},
		});
		const decoded: string[] = [];
		for await (const payload of decodedBedrockEventPayloads(stream)) {
			decoded.push(payload);
		}
		expect(decoded).toEqual(bedrockJsonlLines("text-basic"));

		async function* iterable() {
			for (const line of decoded) yield line;
		}
		const events = normalizeBedrockEvents(
			await collectAsync(assembleFromPayloads(iterable(), bedrockAdapter())),
		);
		expect(events).toEqual(expectedBedrockEvents("text-basic"));
	});

	it("LSA-B78: decodeBedrockEventStreamBytes rejects corrupted prelude CRC", () => {
		const bytes = bedrockBinaryFixture("event-stream-bytes");
		expect(() => decodeBedrockEventStreamBytes(corruptPreludeCrc(bytes))).toThrow(
			/prelude CRC mismatch/,
		);
	});

	it("LSA-B96: chunkBytes splits event-stream fixture deterministically", () => {
		const bytes = bedrockBinaryFixture("event-stream-bytes");
		const chunks = chunkBytes(bytes, 11);
		expect(chunks.length).toBeGreaterThan(1);
		expect(chunks.reduce((sum, chunk) => sum + chunk.length, 0)).toBe(bytes.length);
	});

	it("LSA-B97: decodedBedrockEventPayloads handles chunked ReadableStream source", async () => {
		const bytes = bedrockBinaryFixture("event-stream-bytes");
		const stream = readableFromChunks(chunkBytes(bytes, 13));
		const decoded: string[] = [];
		for await (const payload of decodedBedrockEventPayloads(stream)) decoded.push(payload);
		expect(decoded).toEqual(bedrockJsonlLines("text-basic"));
	});

	it("LSA-B98: decodeBedrockEventStreamBytes rejects corrupted message CRC", () => {
		const bytes = bedrockBinaryFixture("event-stream-bytes");
		expect(() => decodeBedrockEventStreamBytes(corruptMessageCrc(bytes))).toThrow(
			/message CRC mismatch/,
		);
	});

	it("LSA-B99: decoded payloads are valid JSON objects per line", () => {
		const payloads = decodeBedrockEventStreamBytes(bedrockBinaryFixture("event-stream-bytes"));
		for (const line of payloads) {
			expect(() => JSON.parse(line)).not.toThrow();
		}
	});

	it("LSA-B100: chunkBytes keeps single chunk for non-positive size", () => {
		const bytes = bedrockBinaryFixture("event-stream-bytes");
		expect(chunkBytes(bytes, 0)).toHaveLength(1);
		expect(chunkBytes(bytes, -1)).toHaveLength(1);
	});
});
