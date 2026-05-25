import { describe, expect, it } from "vitest";
import { assembleFromPayloads } from "../src/core/assemble-payloads";
import { assembleStream } from "../src/core/assemble-stream";
import { collectAsync, strings } from "./helpers/collect-events";

describe("abort and incomplete lifecycle", () => {
	it("LSA-C48: AbortSignal emits finish aborted and stops iteration", async () => {
		const controller = new AbortController();
		let count = 0;
		const events = await collectAsync(
			assembleFromPayloads(
				strings("a", "b"),
				{
					parseChunk(raw) {
						count += 1;
						if (raw === "a") controller.abort();
						return [{ kind: "text-delta", text: raw }];
					},
				},
				{ signal: controller.signal },
			),
		);

		expect(count).toBe(1);
		expect(events).toEqual([
			{ type: "text.delta", text: "a" },
			{ type: "text.done", text: "a" },
			{ type: "finish", reason: "aborted" },
		]);
	});

	it("LSA-C49: stream ending without provider finish or DONE is incomplete", async () => {
		const events = await collectAsync(
			assembleFromPayloads(strings("a"), {
				parseChunk() {
					return [{ kind: "text-delta", text: "partial" }];
				},
			}),
		);
		expect(events).toEqual([
			{ type: "text.delta", text: "partial" },
			{ type: "text.done", text: "partial" },
			{ type: "finish", reason: "incomplete" },
		]);
	});

	it("LSA-C50: provider finish and DONE both produce one stop finish", async () => {
		const fromProvider = await collectAsync(
			assembleFromPayloads(strings("a"), {
				parseChunk() {
					return [{ kind: "finish", reason: "stop" }];
				},
			}),
		);
		expect(fromProvider).toEqual([{ type: "finish", reason: "stop" }]);

		const fromDone = await collectAsync(
			assembleFromPayloads(strings("[DONE]"), {
				parseChunk() {
					throw new Error("must not parse DONE");
				},
			}),
		);
		expect(fromDone).toEqual([{ type: "finish", reason: "stop" }]);
	});

	it("LSA-C51: cancels ReadableStream readers on early consumer cancellation", async () => {
		let cancelled = false;
		const stream = new ReadableStream<Uint8Array>({
			pull(controller) {
				controller.enqueue(new TextEncoder().encode("data: a\n\n"));
			},
			cancel() {
				cancelled = true;
			},
		});
		const events = assembleStream(stream, {
			parseChunk() {
				return [{ kind: "text-delta", text: "a" }];
			},
		});

		for await (const event of events) {
			expect(event).toEqual({ type: "text.delta", text: "a" });
			break;
		}

		expect(cancelled).toBe(true);
	});
});
