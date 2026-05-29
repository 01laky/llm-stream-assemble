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

	it("LSA-T100: isFinish narrows finish reason payload", () => {
		const event: StreamEvent = { type: "finish", reason: "stop" };
		expect(isFinish(event)).toBe(true);
	});

	it("LSA-T101: isToolCallDone matches tool_call.done events", () => {
		expect(isToolCallDone({ type: "tool_call.done", id: "t1", name: "fn", args: {} })).toBe(true);
	});

	it("LSA-T102: isTextDelta rejects json.delta", () => {
		expect(isTextDelta({ type: "json.delta", delta: "{}" })).toBe(false);
	});

	it("LSA-T103: isError rejects plain objects without error type", () => {
		expect(isError({ type: "finish", reason: "error" })).toBe(false);
	});

	it("LSA-M20: matchEvent supports usage handler", () => {
		const value = matchEvent(
			{ type: "usage", inputTokens: 1, outputTokens: 2 },
			{
				usage: (event) => (event.outputTokens ?? 0) - (event.inputTokens ?? 0),
			},
		);
		expect(value).toBe(1);
	});

	it("LSA-M21: matchEvent supports citation handler", () => {
		const value = matchEvent(
			{ type: "citation", urls: ["https://a.test"] },
			{
				citation: (event) => event.urls?.[0],
			},
		);
		expect(value).toBe("https://a.test");
	});

	it("LSA-M22: matchEvent supports grounding handler", () => {
		const value = matchEvent(
			{ type: "grounding", queries: ["query"] },
			{
				grounding: (event) => event.queries?.length ?? 0,
			},
		);
		expect(value).toBe(1);
	});

	it("LSA-M23: matchEvent supports logprob handler", () => {
		const value = matchEvent(
			{ type: "logprob", channel: "content", token: "a", logprob: -0.1 },
			{
				logprob: (event) => event.token,
			},
		);
		expect(value).toBe("a");
	});
});
