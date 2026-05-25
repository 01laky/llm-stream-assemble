import { describe, expect, it } from "vitest";
import {
	asNumber,
	asString,
	isRecord,
	optionalRawChunk,
	parseAdapterJSON,
	prefixedAdapterError,
} from "../src/adapters/utils";

describe("adapters utils extended edge cases", () => {
	it("LSA-MAINT-EXT01: asNumber rejects non-finite numbers", () => {
		expect(asNumber(Number.POSITIVE_INFINITY)).toBeUndefined();
		expect(asNumber(Number.NEGATIVE_INFINITY)).toBeUndefined();
		expect(asNumber(Number.NaN)).toBeUndefined();
	});

	it("LSA-MAINT-EXT02: optionalRawChunk preserves explicit null values", () => {
		expect(optionalRawChunk({ kind: "usage", raw: null })).toEqual({ kind: "usage", raw: null });
	});

	it("LSA-MAINT-EXT03: parseAdapterJSON prefixes non-Error JSON.parse failures", () => {
		const original = JSON.parse;
		JSON.parse = () => {
			throw "weird";
		};
		try {
			expect(() => parseAdapterJSON("{", "test.parseChunk")).toThrow(/test\.parseChunk: weird/);
		} finally {
			JSON.parse = original;
		}
	});

	it("LSA-MAINT-EXT04: isRecord rejects arrays and null", () => {
		expect(isRecord([])).toBe(false);
		expect(isRecord(null)).toBe(false);
		expect(isRecord("x")).toBe(false);
	});

	it("LSA-MAINT-EXT05: asString rejects non-string values", () => {
		expect(asString(1)).toBeUndefined();
		expect(asString(true)).toBeUndefined();
		expect(asString("ok")).toBe("ok");
	});

	it("LSA-MAINT-EXT06: prefixedAdapterError includes adapter scope", () => {
		expect(() => {
			throw prefixedAdapterError("demo.parseChunk", "bad payload");
		}).toThrow(/llm-stream-assemble: demo\.parseChunk: bad payload/);
	});

	it("LSA-MAINT-EXT07: optionalRawChunk strips undefined optional fields only", () => {
		expect(
			optionalRawChunk({
				kind: "tool-start",
				id: undefined,
				name: "fn",
				index: 0,
			}),
		).toEqual({ kind: "tool-start", name: "fn", index: 0 });
	});
});
