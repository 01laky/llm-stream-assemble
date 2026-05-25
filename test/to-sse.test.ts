import { describe, expect, it } from "vitest";
import type { StreamEvent } from "../src/core/types";
import { toSSE } from "../src/transforms/to-sse";

async function* events(...items: StreamEvent[]): AsyncIterable<StreamEvent> {
	for (const item of items) yield item;
}

async function readStream(stream: ReadableStream<Uint8Array>): Promise<string> {
	const reader = stream.getReader();
	const decoder = new TextDecoder();
	let text = "";
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		text += decoder.decode(value, { stream: true });
	}
	return text + decoder.decode();
}

describe("toSSE", () => {
	it("LSA-T20: serializes text event as data JSON", async () => {
		await expect(readStream(toSSE(events({ type: "text.delta", text: "hi" })))).resolves.toBe(
			'data: {"type":"text.delta","text":"hi"}\n\n',
		);
	});

	it("LSA-T21: serializes multiple events in order", async () => {
		await expect(
			readStream(
				toSSE(events({ type: "text.delta", text: "a" }, { type: "finish", reason: "stop" })),
			),
		).resolves.toBe(
			'data: {"type":"text.delta","text":"a"}\n\ndata: {"type":"finish","reason":"stop"}\n\n',
		);
	});

	it("LSA-T22: UTF-8 encodes unicode correctly", async () => {
		await expect(readStream(toSSE(events({ type: "text.delta", text: "😀" })))).resolves.toContain(
			"😀",
		);
	});

	it("LSA-T23: error event serializes name and message without stack", async () => {
		const output = await readStream(toSSE(events({ type: "error", error: new TypeError("boom") })));
		expect(output).toContain('"name":"TypeError"');
		expect(output).toContain('"message":"boom"');
		expect(output).not.toContain("stack");
	});

	it("LSA-T24: sanitizeErrors replaces error message", async () => {
		const output = await readStream(
			toSSE(events({ type: "error", error: new Error("secret") }), { sanitizeErrors: true }),
		);
		expect(output).toContain("An error occurred while processing the stream.");
		expect(output).not.toContain("secret");
	});

	it("LSA-T25: finish event closes stream", async () => {
		await expect(
			readStream(
				toSSE(
					events(
						{ type: "finish", reason: "stop" },
						{ type: "text.delta", text: "should not serialize" },
					),
				),
			),
		).resolves.toBe('data: {"type":"finish","reason":"stop"}\n\n');
	});

	it("LSA-T26: canceling readable stream calls upstream return", async () => {
		let returned = false;
		const stream = toSSE(returningIterable(() => (returned = true)));
		const reader = stream.getReader();
		await reader.read();
		await reader.cancel();
		expect(returned).toBe(true);
	});

	it("LSA-T27: source iterator throw errors the readable stream", async () => {
		await expect(readStream(toSSE(failingIterable()))).rejects.toThrow("source failed");
	});

	it("LSA-T28: provider error StreamEvent serializes normally", async () => {
		const output = await readStream(
			toSSE(events({ type: "error", error: new Error("provider"), recoverable: false })),
		);
		expect(output).toContain('"type":"error"');
		expect(output).toContain('"recoverable":false');
	});

	it("LSA-T28b: serialized error events never include stack traces", async () => {
		const error = new Error("boom");
		const output = await readStream(toSSE(events({ type: "error", error })));
		expect(output).not.toContain(error.stack ?? "STACK");
	});

	it("LSA-T28c: SSE output does not include event fields", async () => {
		const output = await readStream(toSSE(events({ type: "text.delta", text: "hi" })));
		expect(output).not.toContain("event:");
	});
});

function returningIterable(onReturn: () => void): AsyncIterable<StreamEvent> {
	return {
		[Symbol.asyncIterator]() {
			let emitted = false;
			return {
				async next() {
					if (emitted) return { done: true, value: undefined };
					emitted = true;
					return { done: false, value: { type: "text.delta", text: "a" } as StreamEvent };
				},
				async return() {
					onReturn();
					return { done: true, value: undefined };
				},
			};
		},
	};
}

function failingIterable(): AsyncIterable<StreamEvent> {
	return {
		[Symbol.asyncIterator]() {
			return {
				async next(): Promise<IteratorResult<StreamEvent>> {
					throw new Error("source failed");
				},
			};
		},
	};
}
