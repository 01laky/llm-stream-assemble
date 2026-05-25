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
});
