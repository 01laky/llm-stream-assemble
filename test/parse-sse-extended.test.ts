import { describe, expect, it } from "vitest";
import { parseSSE } from "../src/core/parse-sse";
import { SSEParser } from "../src/core/utils/sse-parser";
import { collectAsync, strings } from "./helpers/collect-events";

describe("parseSSE extended edge cases", () => {
	it("LSA-C-EXT18: flush yields payload when stream ends without trailing blank line", async () => {
		await expect(collectAsync(parseSSE(strings("data: trailing-payload")))).resolves.toEqual([
			"trailing-payload",
		]);
	});

	it("LSA-C-EXT19: empty data line dispatches nothing", async () => {
		await expect(collectAsync(parseSSE(strings("data: \n\n")))).resolves.toEqual([]);
	});

	it("LSA-C-EXT20: ignores non-data SSE fields", async () => {
		await expect(
			collectAsync(parseSSE(strings("event: message\nid: 1\nretry: 1000\ndata: kept\n\n"))),
		).resolves.toEqual(["kept"]);
	});

	it("LSA-C-EXT21: splits chunk mid-CRLF boundary", async () => {
		await expect(collectAsync(parseSSE(strings("data: split\r", "\n\n")))).resolves.toEqual([
			"split",
		]);
	});

	it("LSA-C-EXT22: handles CR-only line endings", () => {
		const parser = new SSEParser();
		expect(parser.push("data: cr-only\r\r")).toEqual(["cr-only"]);
	});

	it("LSA-C-EXT23: field line without colon is treated as empty data and filtered", () => {
		const parser = new SSEParser();
		expect(parser.push("data\n\n")).toEqual([]);
	});

	it("LSA-C-EXT24: string async iterable source is accepted without byte decoding", async () => {
		await expect(collectAsync(parseSSE(strings("data: from-iterable\n\n")))).resolves.toEqual([
			"from-iterable",
		]);
	});

	it("LSA-C-EXT25: SSEParser flush drains pending data lines after partial line buffer", () => {
		const parser = new SSEParser();
		expect(parser.push("data: line-one")).toEqual([]);
		expect(parser.flush()).toEqual(["line-one"]);
	});

	it("LSA-C-EXT26: multiple events with only LF separators remain ordered", async () => {
		await expect(
			collectAsync(parseSSE(strings("data: first\n\n", "data: second\n\n", "data: third\n\n"))),
		).resolves.toEqual(["first", "second", "third"]);
	});
});
