import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { assembleStream } from "../src/core/assemble-stream";
import { collectAsync, byteStreamFromStrings } from "./helpers/collect-events";
import { mockAdapterFromFixture } from "./helpers/mock-adapter";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures/core");

function fixture(name: string, extension: string): string {
	return readFileSync(join(fixturesDir, `${name}.${extension}`), "utf8");
}

describe("assembleStream", () => {
	it("LSA-C42: matches the text-basic SSE golden fixture", async () => {
		const events = await collectAsync(
			assembleStream(
				byteStreamFromStrings(fixture("text-basic", "sse")),
				mockAdapterFromFixture("text-basic"),
			),
		);
		expect(events).toEqual(JSON.parse(fixture("text-basic", "expected.json")));
	});

	it("LSA-C43: processes ReadableStream byte chunks end-to-end", async () => {
		const events = await collectAsync(
			assembleStream(byteStreamFromStrings('data: {"seq":1}\n', "\n", "data: [DONE]\n\n"), {
				parseChunk() {
					return [{ kind: "text-delta", text: "bytes" }];
				},
			}),
		);
		expect(events).toEqual([
			{ type: "text.delta", text: "bytes" },
			{ type: "text.done", text: "bytes" },
			{ type: "finish", reason: "stop" },
		]);
	});
});
