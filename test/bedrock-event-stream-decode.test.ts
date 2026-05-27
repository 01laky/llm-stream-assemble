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
		bytes[9] ^= 0xff;
		expect(() => decodeBedrockEventStreamBytes(bytes)).toThrow(/prelude CRC mismatch/);
	});
});
