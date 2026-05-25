import { describe, expect, it } from "vitest";
import type { StreamEvent } from "../src/core/types";
import { collectStream } from "../src/transforms/collect-stream";
import { tapEvents } from "../src/transforms/tap-events";
import { toSSE } from "../src/transforms/to-sse";
import { collectAsync } from "./helpers/collect-events";

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

describe("transforms extended edge cases", () => {
	it("LSA-T-EXT01: preferDone overwrites when done text conflicts with deltas", async () => {
		await expect(
			collectStream(
				events({ type: "text.delta", text: "hello" }, { type: "text.done", text: "world" }),
			),
		).resolves.toMatchObject({ text: "world" });
	});

	it("LSA-T-EXT02: preferDone keeps current when done is a suffix already present", async () => {
		await expect(
			collectStream(
				events({ type: "text.delta", text: "hello" }, { type: "text.done", text: "lo" }),
			),
		).resolves.toMatchObject({ text: "hello" });
	});

	it("LSA-T-EXT03: collectStream ignores json.delta tool_call.start and message.start", async () => {
		await expect(
			collectStream(
				events(
					{ type: "message.start", id: "m1" },
					{ type: "json.delta", delta: '{"a":' },
					{ type: "tool_call.start", id: "t1", name: "fn" },
					{ type: "tool_call.args.delta", id: "t1", delta: "{" },
					{ type: "json.done", value: { ok: true } },
					{ type: "tool_call.done", id: "t1", name: "fn", args: { x: 1 } },
				),
			),
		).resolves.toMatchObject({
			json: { ok: true },
			toolCalls: [{ id: "t1", name: "fn", args: { x: 1 } }],
		});
	});

	it("LSA-T-EXT04: collectStream throws on recoverable false errors", async () => {
		await expect(
			collectStream(events({ type: "error", error: new Error("fatal"), recoverable: false })),
		).rejects.toThrow("fatal");
	});

	it("LSA-T-EXT05: toSSE closes cleanly when source ends without finish event", async () => {
		await expect(readStream(toSSE(events({ type: "text.delta", text: "tail" })))).resolves.toBe(
			'data: {"type":"text.delta","text":"tail"}\n\n',
		);
	});

	it("LSA-T-EXT06: sanitizeErrors prefers event.sanitized when provided", async () => {
		const output = await readStream(
			toSSE(
				events({
					type: "error",
					error: new Error("secret"),
					sanitized: "safe client message",
				}),
				{ sanitizeErrors: true },
			),
		);
		expect(output).toContain("safe client message");
		expect(output).not.toContain("secret");
	});

	it("LSA-T-EXT07: error serialization omits recoverable when undefined and keeps sanitized", async () => {
		const raw = await readStream(
			toSSE(events({ type: "error", error: new Error("x"), sanitized: "public" })),
		);
		expect(raw).toContain('"sanitized":"public"');
		expect(raw).not.toContain("recoverable");

		const explicit = await readStream(
			toSSE(events({ type: "error", error: new Error("x"), recoverable: true })),
		);
		expect(explicit).toContain('"recoverable":true');
	});

	it("LSA-T-EXT08: tapEvents over empty source yields nothing", async () => {
		const seen: string[] = [];
		await expect(
			collectAsync(tapEvents(events(), (event) => seen.push(event.type))),
		).resolves.toEqual([]);
		expect(seen).toEqual([]);
	});

	it("LSA-T-EXT09: tapEvents calls upstream return when source next throws", async () => {
		let returned = false;
		const iterable: AsyncIterable<StreamEvent> = {
			[Symbol.asyncIterator]() {
				return {
					async next(): Promise<IteratorResult<StreamEvent>> {
						throw new Error("source failed");
					},
					async return() {
						returned = true;
						return { done: true, value: undefined };
					},
				};
			},
		};

		await expect(collectAsync(tapEvents(iterable, () => undefined))).rejects.toThrow(
			"source failed",
		);
		expect(returned).toBe(true);
	});

	it("LSA-T-EXT10: preferDone uses done when it extends current delta prefix", async () => {
		await expect(
			collectStream(
				events({ type: "text.delta", text: "hel" }, { type: "text.done", text: "hello" }),
			),
		).resolves.toMatchObject({ text: "hello" });
	});
});
