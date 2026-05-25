import { describe, expect, it } from "vitest";
import { assembleStream } from "../src/core/assemble-stream";
import { collectAsync, byteStreamFromStrings } from "./helpers/collect-events";

describe("performance smoke", () => {
	it("LSA-C52: assembles ten thousand small SSE payloads without obvious O(n²) behavior", async () => {
		const chunks = Array.from({ length: 10_000 }, (_, index) => `data: ${index}\n\n`);
		chunks.push("data: [DONE]\n\n");
		const started = performance.now();
		const events = await collectAsync(
			assembleStream(byteStreamFromStrings(...chunks), {
				parseChunk() {
					return [{ kind: "text-delta", text: "x" }];
				},
			}),
		);
		const elapsed = performance.now() - started;

		expect(events).toHaveLength(10_002);
		expect(events.at(-2)).toEqual({ type: "text.done", text: "x".repeat(10_000) });
		expect(events.at(-1)).toEqual({ type: "finish", reason: "stop" });
		expect(elapsed).toBeLessThan(5_000);
	}, 10_000);
});
