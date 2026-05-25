import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { assembleFromPayloads } from "../src/core/assemble-payloads";
import type { RawChunk } from "../src/core/types";
import { collectAsync, strings } from "./helpers/collect-events";
import { mockAdapterFromFixture } from "./helpers/mock-adapter";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures/core");

function expected(name: string): unknown {
	return JSON.parse(readFileSync(join(fixturesDir, `${name}.expected.json`), "utf8")) as unknown;
}

describe("assembleFromPayloads", () => {
	it("LSA-C36: matches the text-basic golden fixture", async () => {
		const events = await collectAsync(
			assembleFromPayloads(
				strings('{"seq":1}', '{"seq":2}', "[DONE]"),
				mockAdapterFromFixture("text-basic"),
			),
		);
		expect(events).toEqual(expected("text-basic"));
	});

	it("LSA-C37: matches the tool-single golden fixture", async () => {
		const events = await collectAsync(
			assembleFromPayloads(
				strings('{"seq":1}', '{"seq":2}', '{"seq":3}', "[DONE]"),
				mockAdapterFromFixture("tool-single"),
			),
		);
		expect(events).toEqual(expected("tool-single"));
	});

	it("LSA-C38: matches the tool-parallel golden fixture", async () => {
		const events = await collectAsync(
			assembleFromPayloads(
				strings("a", "b", "c", "d", "[DONE]"),
				mockAdapterFromFixture("tool-parallel"),
			),
		);
		expect(events).toEqual(expected("tool-parallel"));
	});

	it("LSA-C39: recoverMalformed emits recoverable errors and continues", async () => {
		const adapter = {
			parseChunk(raw: string): RawChunk[] {
				if (raw === "bad") throw new Error("bad payload");
				return [{ kind: "text-delta", text: raw }];
			},
		};
		const events = await collectAsync(
			assembleFromPayloads(strings("ok", "bad", "done", "[DONE]"), adapter, {
				recoverMalformed: true,
			}),
		);
		expect(events).toEqual([
			{ type: "text.delta", text: "ok" },
			{
				type: "error",
				error: expect.any(Error) as Error,
				recoverable: true,
			},
			{ type: "text.delta", text: "done" },
			{ type: "text.done", text: "okdone" },
			{ type: "finish", reason: "stop" },
		]);
	});

	it("LSA-C40: recoverMalformed false propagates adapter errors", async () => {
		const adapter = {
			parseChunk(): RawChunk[] {
				throw new Error("bad payload");
			},
		};
		await expect(collectAsync(assembleFromPayloads(strings("bad"), adapter))).rejects.toThrow(
			"bad payload",
		);
	});

	it("LSA-C41: calls upstream return on abort or thrown errors", async () => {
		let returned = false;
		const payloads: AsyncIterable<string> = {
			[Symbol.asyncIterator]() {
				return {
					async next() {
						return { done: false, value: "bad" };
					},
					async return() {
						returned = true;
						return { done: true, value: undefined };
					},
				};
			},
		};
		const adapter = {
			parseChunk(): RawChunk[] {
				throw new Error("stop");
			},
		};

		await expect(collectAsync(assembleFromPayloads(payloads, adapter))).rejects.toThrow("stop");
		expect(returned).toBe(true);
	});
});
