import { describe, expect, it } from "vitest";
import { parsePartialJSON } from "../src/core/parse-partial-json";

describe("parsePartialJSON", () => {
	it("LSA-C11: parses a complete object", () => {
		expect(parsePartialJSON('{"a":1}')).toEqual({ complete: true, value: { a: 1 } });
	});

	it("LSA-C12: parses a complete array", () => {
		expect(parsePartialJSON("[1,2,3]")).toEqual({ complete: true, value: [1, 2, 3] });
	});

	it("LSA-C13: recovers an incomplete string value", () => {
		expect(parsePartialJSON('{"name":"hel')).toEqual({
			complete: false,
			value: { name: "hel" },
		});
	});

	it("LSA-C14: recovers nested incomplete objects", () => {
		expect(parsePartialJSON('{"a":{"b":"c"')).toEqual({
			complete: false,
			value: { a: { b: "c" } },
		});
	});

	it("LSA-C15: treats empty input as incomplete without value", () => {
		expect(parsePartialJSON("   ")).toEqual({ complete: false });
	});

	it("LSA-C16: returns first value with complete false for trailing garbage", () => {
		expect(parsePartialJSON('{"a":1} nope')).toEqual({ complete: false, value: { a: 1 } });
	});

	it("LSA-C17: preserves unicode in partial strings", () => {
		expect(parsePartialJSON('{"emoji":"😀')).toEqual({
			complete: false,
			value: { emoji: "😀" },
		});
	});

	it("LSA-C18: parses primitive literals", () => {
		expect(parsePartialJSON("null")).toEqual({ complete: true, value: null });
		expect(parsePartialJSON("true")).toEqual({ complete: true, value: true });
		expect(parsePartialJSON("42")).toEqual({ complete: true, value: 42 });
	});

	it("LSA-PJ-EXT01: recovers incomplete top-level array values", () => {
		expect(parsePartialJSON("[1,2,")).toEqual({ complete: false, value: [1, 2] });
	});

	it("LSA-PJ-EXT02: recovers object with trailing comma", () => {
		expect(parsePartialJSON('{"a":1,')).toEqual({ complete: false, value: { a: 1 } });
	});

	it("LSA-PJ-EXT03: recovers dangling key fragment", () => {
		expect(parsePartialJSON('{"a":')).toEqual({ complete: false, value: { a: undefined } });
	});

	it("LSA-PJ-EXT04: returns incomplete without value for unrecoverable garbage", () => {
		expect(parsePartialJSON("not json")).toEqual({ complete: false });
		expect(parsePartialJSON("{")).toEqual({ complete: false, value: {} });
	});

	it("LSA-PJ-EXT05: repairs open string with trailing backslash to empty value", () => {
		const result = parsePartialJSON('{"a":"\\');
		expect(result.complete).toBe(false);
		expect(result.value).toEqual({ a: "" });
	});

	it("LSA-PJ-EXT06: recovers partial top-level string literal", () => {
		expect(parsePartialJSON('"hello')).toEqual({ complete: false, value: "hello" });
	});

	it("LSA-PJ-EXT07: recovers nested incomplete array inside object", () => {
		expect(parsePartialJSON('{"items":[1,')).toEqual({ complete: false, value: { items: [1] } });
	});

	it("LSA-PJ-EXT08: preserves escaped quotes inside partial strings", () => {
		expect(parsePartialJSON('{"msg":"say \\"hi')).toEqual({
			complete: false,
			value: { msg: 'say "hi' },
		});
	});

	it("LSA-PJ-EXT09: rejects mismatched brackets without emitting false value", () => {
		expect(parsePartialJSON('{"a":]')).toEqual({ complete: false });
	});

	it("LSA-PJ-EXT10: does not emit value for partial numeric fragments", () => {
		expect(parsePartialJSON("12.")).toEqual({ complete: false });
		expect(parsePartialJSON("-")).toEqual({ complete: false });
	});
});
