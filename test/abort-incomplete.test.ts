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

describe("abort and incomplete lifecycle matrix x281-x295", () => {
	it("LSA-X281: pre-aborted signal yields only aborted finish", async () => {
		const controller = new AbortController();
		controller.abort();
		const events = await collectAsync(
			assembleFromPayloads(
				strings("ignored"),
				{
					parseChunk() {
						throw new Error("must not parse");
					},
				},
				{ signal: controller.signal },
			),
		);
		expect(events).toEqual([{ type: "finish", reason: "aborted" }]);
	});

	it("LSA-X282: abort after first text delta flushes text.done before aborted finish", async () => {
		const controller = new AbortController();
		const events = await collectAsync(
			assembleFromPayloads(
				strings("a", "b"),
				{
					parseChunk(raw) {
						if (raw === "a") controller.abort();
						return [{ kind: "text-delta", text: raw }];
					},
				},
				{ signal: controller.signal },
			),
		);
		expect(events).toEqual([
			{ type: "text.delta", text: "a" },
			{ type: "text.done", text: "a" },
			{ type: "finish", reason: "aborted" },
		]);
	});

	it("LSA-X283: DONE payload bypasses parseChunk and yields stop finish", async () => {
		const events = await collectAsync(
			assembleFromPayloads(strings("[DONE]"), {
				parseChunk() {
					throw new Error("must not parse DONE");
				},
			}),
		);
		expect(events).toEqual([{ type: "finish", reason: "stop" }]);
	});

	it("LSA-X284: DONE marker still emits stop finish even with trailing payload", async () => {
		const events = await collectAsync(
			assembleFromPayloads(
				strings("[DONE]", "late"),
				{
					parseChunk(raw) {
						return [{ kind: "text-delta", text: raw }];
					},
				},
				{ recoverMalformed: true },
			),
		);
		expect(events.at(-1)).toEqual({ type: "finish", reason: "stop" });
		expect(events.some((event) => event.type === "text.delta")).toBe(true);
	});

	it("LSA-X285: provider stop finish suppresses implicit incomplete finish", async () => {
		const events = await collectAsync(
			assembleFromPayloads(strings("x"), {
				parseChunk() {
					return [{ kind: "finish", reason: "stop" }];
				},
			}),
		);
		expect(events).toEqual([{ type: "finish", reason: "stop" }]);
	});

	it("LSA-X286: provider error finish is terminal", async () => {
		const events = await collectAsync(
			assembleFromPayloads(strings("x", "y"), {
				parseChunk(raw) {
					return raw === "x"
						? [{ kind: "finish", reason: "error" }]
						: [{ kind: "text-delta", text: "late" }];
				},
			}),
		);
		expect(events).toEqual([{ type: "finish", reason: "error" }]);
	});

	it("LSA-X287: recoverMalformed keeps stream alive after parse errors", async () => {
		const events = await collectAsync(
			assembleFromPayloads(
				strings("bad", "ok"),
				{
					parseChunk(raw) {
						if (raw === "bad") throw new Error("bad payload");
						return [{ kind: "text-delta", text: "ok" }];
					},
				},
				{ recoverMalformed: true },
			),
		);
		expect(events.some((event) => event.type === "error" && event.recoverable)).toBe(true);
		expect(events).toContainEqual({ type: "text.delta", text: "ok" });
		expect(events.at(-1)).toEqual({ type: "finish", reason: "incomplete" });
	});

	it("LSA-X288: unrecovered parse errors still throw", async () => {
		await expect(
			collectAsync(
				assembleFromPayloads(strings("bad"), {
					parseChunk() {
						throw new Error("bad payload");
					},
				}),
			),
		).rejects.toThrow("bad payload");
	});

	it("LSA-X289: assembleStream abort emits aborted finish", async () => {
		const controller = new AbortController();
		const events = await collectAsync(
			assembleStream(
				strings("data: first\n\n", "data: second\n\n"),
				{
					parseChunk(raw) {
						if (raw === "first") controller.abort();
						return [{ kind: "text-delta", text: raw }];
					},
				},
				{ signal: controller.signal },
			),
		);
		expect(events.at(-1)).toEqual({ type: "finish", reason: "aborted" });
	});

	it("LSA-X290: assembleStream DONE marker emits stop finish", async () => {
		const events = await collectAsync(
			assembleStream(strings("data: [DONE]\n\n"), {
				parseChunk() {
					throw new Error("must not parse DONE");
				},
			}),
		);
		expect(events).toEqual([{ type: "finish", reason: "stop" }]);
	});

	it("LSA-X291: payload stream ending with text emits incomplete finish", async () => {
		const events = await collectAsync(
			assembleFromPayloads(strings("a"), {
				parseChunk() {
					return [{ kind: "text-delta", text: "partial" }];
				},
			}),
		);
		expect(events.at(-2)).toEqual({ type: "text.done", text: "partial" });
		expect(events.at(-1)).toEqual({ type: "finish", reason: "incomplete" });
	});

	it("LSA-X292: provider finish length remains terminal reason", async () => {
		const events = await collectAsync(
			assembleFromPayloads(strings("a"), {
				parseChunk() {
					return [{ kind: "finish", reason: "length" }];
				},
			}),
		);
		expect(events).toEqual([{ type: "finish", reason: "length" }]);
	});

	it("LSA-X293: provider finish tool_calls remains terminal reason", async () => {
		const events = await collectAsync(
			assembleFromPayloads(strings("a"), {
				parseChunk() {
					return [{ kind: "finish", reason: "tool_calls" }];
				},
			}),
		);
		expect(events).toEqual([{ type: "finish", reason: "tool_calls" }]);
	});

	it("LSA-X294: provider finish content_filter remains terminal reason", async () => {
		const events = await collectAsync(
			assembleFromPayloads(strings("a"), {
				parseChunk() {
					return [{ kind: "finish", reason: "content_filter" }];
				},
			}),
		);
		expect(events).toEqual([{ type: "finish", reason: "content_filter" }]);
	});

	it("LSA-X295: provider stop plus DONE yields a single terminal finish", async () => {
		const events = await collectAsync(
			assembleFromPayloads(strings("x", "[DONE]"), {
				parseChunk(raw) {
					if (raw === "x") return [{ kind: "finish", reason: "stop" }];
					throw new Error("DONE should short-circuit");
				},
			}),
		);
		expect(events.filter((event) => event.type === "finish")).toHaveLength(1);
		expect(events[0]).toEqual({ type: "finish", reason: "stop" });
	});
});
