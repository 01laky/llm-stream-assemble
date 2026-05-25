import { describe, expect, it } from "vitest";
import { parseSSE } from "../src/core/parse-sse";
import { byteStreamFromStrings, collectAsync, strings } from "./helpers/collect-events";

describe("parseSSE", () => {
	it("LSA-C01: parses a single data event", async () => {
		await expect(collectAsync(parseSSE(strings('data: {"x":1}\n\n')))).resolves.toEqual([
			'{"x":1}',
		]);
	});

	it("LSA-C02: joins multi-line data events with newline", async () => {
		await expect(collectAsync(parseSSE(strings("data: one\ndata: two\n\n")))).resolves.toEqual([
			"one\ntwo",
		]);
	});

	it("LSA-C03: yields DONE as a literal payload", async () => {
		await expect(collectAsync(parseSSE(strings("data: [DONE]\n\n")))).resolves.toEqual(["[DONE]"]);
	});

	it("LSA-C04: buffers chunks split mid-line", async () => {
		await expect(collectAsync(parseSSE(strings('data: {"x', '":1}\n\n')))).resolves.toEqual([
			'{"x":1}',
		]);
	});

	it("LSA-C05: ignores comments and blank events", async () => {
		await expect(collectAsync(parseSSE(strings(": ping\n\n\ndata: ok\n\n")))).resolves.toEqual([
			"ok",
		]);
	});

	it("LSA-C06: completes empty streams without yielding", async () => {
		await expect(collectAsync(parseSSE(strings()))).resolves.toEqual([]);
	});

	it("LSA-C07: decodes UTF-8 characters split across byte chunks", async () => {
		const bytes = new TextEncoder().encode("data: 😀\n\n");
		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(bytes.slice(0, 8));
				controller.enqueue(bytes.slice(8));
				controller.close();
			},
		});

		await expect(collectAsync(parseSSE(stream))).resolves.toEqual(["😀"]);
	});

	it("LSA-C08: handles CRLF line endings", async () => {
		await expect(collectAsync(parseSSE(strings("data: one\r\n\r\n")))).resolves.toEqual(["one"]);
	});

	it("LSA-C09: yields multiple events in order", async () => {
		await expect(collectAsync(parseSSE(strings("data: a\n\ndata: b\n\n")))).resolves.toEqual([
			"a",
			"b",
		]);
	});

	it("LSA-C10: accepts ReadableStream byte sources", async () => {
		await expect(collectAsync(parseSSE(byteStreamFromStrings("data: bytes\n\n")))).resolves.toEqual(
			["bytes"],
		);
	});
});
