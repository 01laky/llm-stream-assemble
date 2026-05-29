import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { collectStream } from "../src/transforms/collect-stream";
import type { StreamEvent } from "../src/core/types";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

async function* events(...items: StreamEvent[]): AsyncIterable<StreamEvent> {
	for (const item of items) yield item;
}

describe("collectStream", () => {
	it("LSA-T01: collects text deltas into text", async () => {
		await expect(
			collectStream(events({ type: "text.delta", text: "a" }, { type: "text.delta", text: "b" })),
		).resolves.toMatchObject({ text: "ab" });
	});

	it("LSA-T02: uses text.done without duplicating text", async () => {
		await expect(
			collectStream(
				events({ type: "text.delta", text: "hel" }, { type: "text.done", text: "hello" }),
			),
		).resolves.toMatchObject({ text: "hello" });
	});

	it("LSA-T03: collects reasoning deltas and done", async () => {
		await expect(
			collectStream(
				events(
					{ type: "reasoning.delta", text: "think" },
					{ type: "reasoning.done", text: "thinking" },
				),
			),
		).resolves.toMatchObject({ reasoning: "thinking" });
	});

	it("LSA-T04: collects refusal deltas and done", async () => {
		await expect(
			collectStream(
				events({ type: "refusal.delta", text: "no" }, { type: "refusal.done", text: "nope" }),
			),
		).resolves.toMatchObject({ refusals: "nope" });
	});

	it("LSA-T05: stores json.done value", async () => {
		await expect(
			collectStream(events({ type: "json.done", value: { ok: true } })),
		).resolves.toMatchObject({
			json: { ok: true },
		});
	});

	it("LSA-T06: collects multiple tool_call.done events", async () => {
		const result = await collectStream(
			events(
				{ type: "tool_call.done", id: "a", name: "one", args: { a: 1 } },
				{ type: "tool_call.done", id: "b", name: "two", args: { b: 2 } },
			),
		);
		expect(result.toolCalls).toEqual([
			{ id: "a", name: "one", args: { a: 1 } },
			{ id: "b", name: "two", args: { b: 2 } },
		]);
	});

	it("LSA-T07: latest usage wins", async () => {
		await expect(
			collectStream(
				events(
					{ type: "usage", inputTokens: 1 },
					{ type: "usage", inputTokens: 2, outputTokens: 3 },
				),
			),
		).resolves.toMatchObject({ usage: { type: "usage", inputTokens: 2, outputTokens: 3 } });
	});

	it("LSA-T08: latest finish wins", async () => {
		await expect(
			collectStream(
				events({ type: "finish", reason: "incomplete" }, { type: "finish", reason: "stop" }),
			),
		).resolves.toMatchObject({ finishReason: { type: "finish", reason: "stop" } });
	});

	it("LSA-T09: recoverable error does not throw", async () => {
		await expect(
			collectStream(events({ type: "error", error: new Error("recover"), recoverable: true })),
		).resolves.toMatchObject({ text: "" });
	});

	it("LSA-T10: non-recoverable error throws", async () => {
		await expect(
			collectStream(events({ type: "error", error: new Error("fatal") })),
		).rejects.toThrow("fatal");
	});

	it("LSA-T11: upstream return is called when collection throws", async () => {
		let returned = false;
		const iterable: AsyncIterable<StreamEvent> = {
			[Symbol.asyncIterator]() {
				return {
					async next() {
						return { done: false, value: { type: "error", error: new Error("fatal") } };
					},
					async return() {
						returned = true;
						return { done: true, value: undefined };
					},
				};
			},
		};
		await expect(collectStream(iterable)).rejects.toThrow("fatal");
		expect(returned).toBe(true);
	});

	it("LSA-T12: multi-choice text aggregates in stream order", async () => {
		await expect(
			collectStream(
				events(
					{ type: "text.delta", text: "a", choiceIndex: 0 },
					{ type: "text.delta", text: "b", choiceIndex: 1 },
				),
			),
		).resolves.toMatchObject({ text: "ab" });
	});

	it("LSA-T12b: metadata is not collected in Phase 5", async () => {
		const result = await collectStream(events({ type: "metadata", model: "model" }));
		expect("metadata" in result).toBe(false);
	});

	it("LSA-T12c: usage guides warn collectStream materializes full output in memory", () => {
		const guides = readFileSync(join(rootDir, "docs/usage-guides.md"), "utf8");
		expect(guides).toContain("collectStream");
		expect(guides).toContain("materializes");
	});
});
