import { describe, expect, it } from "vitest";
import type { StreamEvent } from "../src/core/types";
import { tapEvents } from "../src/transforms/tap-events";
import { collectAsync } from "./helpers/collect-events";

async function* events(...items: StreamEvent[]): AsyncIterable<StreamEvent> {
	for (const item of items) yield item;
}

describe("tapEvents", () => {
	it("LSA-T13: calls callback for every event", async () => {
		const seen: string[] = [];
		await collectAsync(
			tapEvents(
				events({ type: "text.delta", text: "a" }, { type: "finish", reason: "stop" }),
				(event) => seen.push(event.type),
			),
		);
		expect(seen).toEqual(["text.delta", "finish"]);
	});

	it("LSA-T14: yields original events unchanged", async () => {
		await expect(
			collectAsync(tapEvents(events({ type: "text.delta", text: "a" }), () => undefined)),
		).resolves.toEqual([{ type: "text.delta", text: "a" }]);
	});

	it("LSA-T15: preserves object identity", async () => {
		const event: StreamEvent = { type: "text.delta", text: "same" };
		const result = await collectAsync(tapEvents(events(event), () => undefined));
		expect(result[0]).toBe(event);
	});

	it("LSA-T16: propagates callback errors", async () => {
		await expect(
			collectAsync(
				tapEvents(events({ type: "text.delta", text: "a" }), () => {
					throw new Error("tap failed");
				}),
			),
		).rejects.toThrow("tap failed");
	});

	it("LSA-T17: calls upstream return when callback throws", async () => {
		let returned = false;
		const iterable = returningIterable(() => {
			returned = true;
		});
		await expect(
			collectAsync(
				tapEvents(iterable, () => {
					throw new Error("tap failed");
				}),
			),
		).rejects.toThrow("tap failed");
		expect(returned).toBe(true);
	});

	it("LSA-T18: calls upstream return when consumer stops early", async () => {
		let returned = false;
		for await (const _event of tapEvents(
			returningIterable(() => {
				returned = true;
			}),
			() => undefined,
		)) {
			break;
		}
		expect(returned).toBe(true);
	});

	it("LSA-T19: propagates source iterator errors", async () => {
		await expect(collectAsync(tapEvents(failingIterable(), () => undefined))).rejects.toThrow(
			"source failed",
		);
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
