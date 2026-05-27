import { describe, expect, it } from "vitest";
import { citationSpanAnchor } from "../src/helpers/citation-span-anchor";

describe("citationSpanAnchor", () => {
	it("LSA-CSA01: valid slice extracts anchor text from assistantText", () => {
		expect(
			citationSpanAnchor({
				assistantText: "Benefits include gym memberships and more.",
				span: { start: 17, end: 32, text: "gym memberships" },
			}),
		).toEqual({ anchorText: "gym memberships", consistent: true });
	});

	it("LSA-CSA02: out-of-range offsets return consistent false", () => {
		expect(
			citationSpanAnchor({
				assistantText: "short",
				span: { start: 0, end: 99 },
			}),
		).toEqual({ consistent: false });
	});

	it("LSA-CSA03: span.text mismatch returns consistent false with anchorText", () => {
		expect(
			citationSpanAnchor({
				assistantText: "Benefits include gym memberships and more.",
				span: { start: 17, end: 32, text: "wrong label" },
			}),
		).toEqual({ anchorText: "gym memberships", consistent: false });
	});

	it("LSA-CSA04: missing assistantText with span.text present uses span.text", () => {
		expect(
			citationSpanAnchor({
				span: { start: 0, end: 3, text: "abc" },
			}),
		).toEqual({ anchorText: "abc", consistent: true });
	});

	it("LSA-CSA05: missing span returns consistent false", () => {
		expect(citationSpanAnchor({ assistantText: "hello" })).toEqual({ consistent: false });
	});

	it("LSA-CSA06: negative start offset returns consistent false", () => {
		expect(
			citationSpanAnchor({
				assistantText: "hello",
				span: { start: -1, end: 2 },
			}),
		).toEqual({ consistent: false });
	});

	it("LSA-CSA07: empty slice when start equals end", () => {
		expect(
			citationSpanAnchor({
				assistantText: "hello",
				span: { start: 2, end: 2, text: "" },
			}),
		).toEqual({ anchorText: "", consistent: true });
	});

	it("LSA-CSA08: unicode assistant text slice is correct", () => {
		expect(
			citationSpanAnchor({
				assistantText: "Pozrite čaj 🍵 a kávu.",
				span: { start: 8, end: 14, text: "čaj 🍵" },
			}),
		).toEqual({ anchorText: "čaj 🍵", consistent: true });
	});

	it("LSA-CSA09: non-empty wrong span.text returns consistent false", () => {
		expect(
			citationSpanAnchor({
				assistantText: "hello world",
				span: { start: 0, end: 5, text: "HELLO" },
			}),
		).toEqual({ anchorText: "hello", consistent: false });
	});

	it("LSA-CSA10: no assistantText and no span.text returns consistent false", () => {
		expect(citationSpanAnchor({ span: { start: 0, end: 3 } })).toEqual({ consistent: false });
	});

	it("LSA-CSA11: span.text trim allows match when surrounding whitespace differs", () => {
		expect(
			citationSpanAnchor({
				assistantText: "  padded  ",
				span: { start: 2, end: 8, text: "padded" },
			}),
		).toEqual({ anchorText: "padded", consistent: true });
	});

	it("LSA-CSA12: end beyond length with valid start returns consistent false", () => {
		expect(
			citationSpanAnchor({
				assistantText: "short",
				span: { start: 1, end: 99 },
			}),
		).toEqual({ consistent: false });
	});
});
