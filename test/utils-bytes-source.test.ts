import { describe, expect, it, vi } from "vitest";
import { Utf8StreamDecoder, utf8ByteLength } from "../src/core/utils/bytes";
import {
	errorFromUnknown,
	isReadableStream,
	prefixedError,
	readableStreamToStrings,
	sourceToStrings,
} from "../src/core/utils/source";
import { collectAsync, strings } from "./helpers/collect-events";

describe("bytes and source utilities", () => {
	it("LSA-U-EXT01: utf8ByteLength counts bytes not code units", () => {
		expect(utf8ByteLength("a")).toBe(1);
		expect(utf8ByteLength("😀")).toBe(4);
		expect(utf8ByteLength("ab😀")).toBe(6);
	});

	it("LSA-U-EXT02: Utf8StreamDecoder reassembles UTF-8 split across three chunks", () => {
		const bytes = new TextEncoder().encode("data: 😀");
		const decoder = new Utf8StreamDecoder();
		const part1 = decoder.decode(bytes.slice(0, 6));
		const part2 = decoder.decode(bytes.slice(6, 8));
		const part3 = decoder.decode(bytes.slice(8));
		const flushed = decoder.flush();
		expect(part1 + part2 + part3 + flushed).toBe("data: 😀");
	});

	it("LSA-U-EXT03: readableStreamToStrings cancels reader when iteration breaks early", async () => {
		const cancel = vi.fn(async () => undefined);
		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(new TextEncoder().encode("chunk"));
			},
			cancel,
		});

		for await (const _chunk of readableStreamToStrings(stream)) {
			break;
		}

		expect(cancel).toHaveBeenCalled();
	});

	it("LSA-U-EXT04: readableStreamToStrings skips empty chunks and flushes decoder tail", async () => {
		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(new Uint8Array());
				controller.enqueue(new TextEncoder().encode("tail"));
				controller.close();
			},
		});
		await expect(collectAsync(readableStreamToStrings(stream))).resolves.toEqual(["tail"]);
	});

	it("LSA-U-EXT05: sourceToStrings routes ReadableStream vs AsyncIterable", async () => {
		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(new TextEncoder().encode("stream"));
				controller.close();
			},
		});
		await expect(collectAsync(sourceToStrings(stream))).resolves.toEqual(["stream"]);
		await expect(collectAsync(sourceToStrings(strings("iter")))).resolves.toEqual(["iter"]);
	});

	it("LSA-U-EXT06: isReadableStream distinguishes stream from async iterable", () => {
		const stream = new ReadableStream<Uint8Array>();
		expect(isReadableStream(stream)).toBe(true);
		expect(isReadableStream(strings("x"))).toBe(false);
	});

	it("LSA-U-EXT07: errorFromUnknown wraps non-Error values", () => {
		const fromString = errorFromUnknown("boom");
		expect(fromString).toBeInstanceOf(Error);
		expect(fromString.message).toBe("boom");

		const fromNumber = errorFromUnknown(404);
		expect(fromNumber.message).toBe("404");
	});

	it("LSA-U-EXT08: prefixedError uses llm-stream-assemble prefix", () => {
		expect(prefixedError("test").message).toBe("llm-stream-assemble: test");
	});
});
