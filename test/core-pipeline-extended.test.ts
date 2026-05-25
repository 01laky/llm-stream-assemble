import { describe, expect, it } from "vitest";
import { assembleFromPayloads } from "../src/core/assemble-payloads";
import { assembleResponse } from "../src/core/assemble-response";
import { assembleStream } from "../src/core/assemble-stream";
import { createAssemblyTransform } from "../src/core/create-assembly-transform";
import { collectAsync, strings } from "./helpers/collect-events";

async function collectReadable<T>(readable: ReadableStream<T>): Promise<T[]> {
	const reader = readable.getReader();
	const items: T[] = [];
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		items.push(value);
	}
	return items;
}

describe("core pipeline extended edge cases", () => {
	it("LSA-C-EXT27: assembleFromPayloads emits finish stop when payload is literal DONE", async () => {
		await expect(
			collectAsync(
				assembleFromPayloads(strings("[DONE]"), {
					parseChunk() {
						throw new Error("must not parse DONE");
					},
				}),
			),
		).resolves.toEqual([{ type: "finish", reason: "stop" }]);
	});

	it("LSA-C-EXT28: assembleResponse flushes open buffers and emits terminal finish", () => {
		expect(
			assembleResponse(
				{ ok: true },
				{
					parseResponse() {
						return [{ kind: "text-delta", text: "resp" }];
					},
				},
			),
		).toEqual([
			{ type: "text.delta", text: "resp" },
			{ type: "text.done", text: "resp" },
			{ type: "finish", reason: "stop" },
		]);
	});

	it("LSA-C-EXT29: assembleStream skips empty parseChunk results", async () => {
		await expect(
			collectAsync(
				assembleStream(strings("data: skip\n\n", "data: keep\n\n", "data: [DONE]\n\n"), {
					parseChunk(raw) {
						return raw === "skip" ? [] : [{ kind: "text-delta", text: raw }];
					},
				}),
			),
		).resolves.toEqual([
			{ type: "text.delta", text: "keep" },
			{ type: "text.done", text: "keep" },
			{ type: "finish", reason: "stop" },
		]);
	});

	it("LSA-C-EXT30: createAssemblyTransform closes with finish after writable close", async () => {
		const transform = createAssemblyTransform({
			parseChunk(raw) {
				return [{ kind: "text-delta", text: raw }];
			},
		});
		const collected = collectReadable(transform.readable);
		const writer = transform.writable.getWriter();
		await writer.write(new TextEncoder().encode("data: x\n\n"));
		await writer.write(new TextEncoder().encode("data: [DONE]\n\n"));
		await writer.close();
		const events = await collected;
		expect(events.at(-1)).toEqual({ type: "finish", reason: "stop" });
	});

	it("LSA-C-EXT31: assembleFromPayloads throws when adapter parseChunk throws by default", async () => {
		await expect(
			collectAsync(
				assembleFromPayloads(strings("bad"), {
					parseChunk() {
						throw new Error("adapter parse failed");
					},
				}),
			),
		).rejects.toThrow("adapter parse failed");
	});

	it("LSA-C-EXT31b: recoverMalformed turns adapter parseChunk throws into recoverable error events", async () => {
		const events = await collectAsync(
			assembleFromPayloads(
				strings("bad", "ok"),
				{
					parseChunk(raw) {
						if (raw === "bad") throw new Error("adapter parse failed");
						return [{ kind: "text-delta", text: raw }];
					},
				},
				{ recoverMalformed: true },
			),
		);
		expect(events.some((event) => event.type === "error" && event.recoverable === true)).toBe(true);
		expect(events).toContainEqual({ type: "text.delta", text: "ok" });
	});

	it("LSA-C-EXT32: pre-aborted signal yields aborted finish without parsing payloads", async () => {
		const controller = new AbortController();
		controller.abort();
		await expect(
			collectAsync(
				assembleFromPayloads(
					strings("never"),
					{
						parseChunk() {
							throw new Error("must not parse");
						},
					},
					{ signal: controller.signal },
				),
			),
		).resolves.toEqual([{ type: "finish", reason: "aborted" }]);
	});
});
