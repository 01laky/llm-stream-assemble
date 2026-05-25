import { describe, expect, it } from "vitest";
import { isError, isFinish, isTextDelta, isToolCallDone } from "../src/helpers/type-guards";
import { matchEvent } from "../src/helpers/match-event";
import type { StreamEvent } from "../src/core/types";

describe("helpers extended edge cases", () => {
	it("LSA-G-EXT01: type guards match events with extra unknown properties", () => {
		const event = { type: "text.delta", text: "x", extra: true } as StreamEvent;
		expect(isTextDelta(event)).toBe(true);
	});

	it("LSA-G-EXT02: type guards reject non-matching event types", () => {
		expect(isTextDelta({ type: "finish", reason: "stop" })).toBe(false);
		expect(isFinish({ type: "text.delta", text: "x" })).toBe(false);
		expect(isToolCallDone({ type: "tool_call.start", id: "x", name: "y" })).toBe(false);
	});

	it("LSA-G-EXT03: isError matches error events by type only", () => {
		expect(isError({ type: "error", error: new Error("x") })).toBe(true);
		expect(isError({ type: "error", error: "x" } as unknown as StreamEvent)).toBe(true);
	});

	it("LSA-M-EXT01: matchEvent returns handler result for matching type", () => {
		const value = matchEvent(
			{ type: "text.delta", text: "a" },
			{
				"text.delta": (event) => event.text.length,
			},
		);
		expect(value).toBe(1);
	});

	it("LSA-M-EXT02: matchEvent runs only the matching handler", () => {
		const seen: string[] = [];
		matchEvent(
			{ type: "finish", reason: "stop" },
			{
				"text.delta": () => seen.push("text"),
				finish: () => seen.push("finish"),
				error: () => seen.push("error"),
			},
		);
		expect(seen).toEqual(["finish"]);
	});

	it("LSA-M-EXT03: matchEvent returns undefined when no handler matches", () => {
		expect(matchEvent({ type: "usage", inputTokens: 1 }, {})).toBeUndefined();
	});
});
