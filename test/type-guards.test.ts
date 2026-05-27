import { describe, expect, it } from "vitest";
import {
	isCitation,
	isGrounding,
	isLogprob,
	isError,
	isFinish,
	isJsonDelta,
	isJsonDone,
	isMessageStart,
	isMetadata,
	isReasoningDelta,
	isReasoningDone,
	isRefusalDelta,
	isRefusalDone,
	isTextDelta,
	isTextDone,
	isToolCallArgsDelta,
	isToolCallDone,
	isToolCallStart,
	isUsage,
} from "../src/index";
import type { StreamEvent } from "../src/core/types";
import { sampleEvents } from "./fixtures/sample-events";

type GuardCase = {
	id: string;
	guard: (event: StreamEvent) => boolean;
	match: StreamEvent;
	mismatch: StreamEvent;
};

const guardCases: GuardCase[] = [
	{
		id: "LSA-G01",
		guard: isMessageStart,
		match: sampleEvents.messageStart,
		mismatch: sampleEvents.textDelta,
	},
	{
		id: "LSA-G02",
		guard: isMetadata,
		match: sampleEvents.metadata,
		mismatch: sampleEvents.textDelta,
	},
	{
		id: "LSA-G03",
		guard: isTextDelta,
		match: sampleEvents.textDelta,
		mismatch: sampleEvents.textDone,
	},
	{
		id: "LSA-G04",
		guard: isTextDone,
		match: sampleEvents.textDone,
		mismatch: sampleEvents.textDelta,
	},
	{
		id: "LSA-G05",
		guard: isReasoningDelta,
		match: sampleEvents.reasoningDelta,
		mismatch: sampleEvents.textDelta,
	},
	{
		id: "LSA-G06",
		guard: isReasoningDone,
		match: sampleEvents.reasoningDone,
		mismatch: sampleEvents.reasoningDelta,
	},
	{
		id: "LSA-G07",
		guard: isRefusalDelta,
		match: sampleEvents.refusalDelta,
		mismatch: sampleEvents.textDelta,
	},
	{
		id: "LSA-G08",
		guard: isRefusalDone,
		match: sampleEvents.refusalDone,
		mismatch: sampleEvents.refusalDelta,
	},
	{
		id: "LSA-G09",
		guard: isJsonDelta,
		match: sampleEvents.jsonDelta,
		mismatch: sampleEvents.jsonDone,
	},
	{
		id: "LSA-G10",
		guard: isJsonDone,
		match: sampleEvents.jsonDone,
		mismatch: sampleEvents.jsonDelta,
	},
	{
		id: "LSA-G11",
		guard: isToolCallStart,
		match: sampleEvents.toolCallStart,
		mismatch: sampleEvents.toolCallDone,
	},
	{
		id: "LSA-G12",
		guard: isToolCallArgsDelta,
		match: sampleEvents.toolCallArgsDelta,
		mismatch: sampleEvents.toolCallStart,
	},
	{
		id: "LSA-G13",
		guard: isToolCallDone,
		match: sampleEvents.toolCallDone,
		mismatch: sampleEvents.toolCallArgsDelta,
	},
	{
		id: "LSA-G14",
		guard: isUsage,
		match: sampleEvents.usage,
		mismatch: sampleEvents.finishStop,
	},
	{
		id: "LSA-G15",
		guard: isFinish,
		match: sampleEvents.finishStop,
		mismatch: sampleEvents.usage,
	},
	{
		id: "LSA-G16",
		guard: isError,
		match: sampleEvents.error,
		mismatch: sampleEvents.finishError,
	},
];

describe("type-guards.test.ts", () => {
	describe.each(guardCases)("$id", ({ guard, match, mismatch }) => {
		it("returns true for matching event type", () => {
			expect(guard(match)).toBe(true);
		});

		it("returns false for non-matching event type", () => {
			expect(guard(mismatch)).toBe(false);
		});
	});

	it("LSA-G17: each guard matches exactly one sample event type", () => {
		for (const { match, guard } of guardCases) {
			const trueCount = guardCases.filter(({ guard: g }) => g(match)).length;
			expect(trueCount).toBe(1);
			expect(guard(match)).toBe(true);
		}
	});

	it("LSA-G116: isCitation guard discriminates citation events", () => {
		expect(isCitation({ type: "citation", urls: ["https://g116.test"] })).toBe(true);
		expect(isCitation({ type: "grounding", queries: [] })).toBe(false);
		expect(isCitation({ type: "text.delta", text: "x" })).toBe(false);
	});

	it("LSA-G117: isGrounding guard discriminates grounding events", () => {
		expect(isGrounding({ type: "grounding", queries: ["q"] })).toBe(true);
		expect(isGrounding({ type: "citation", urls: [] })).toBe(false);
		expect(isGrounding({ type: "metadata" })).toBe(false);
	});

	it("LSA-G118: isLogprob guard discriminates logprob events", () => {
		expect(
			isLogprob({
				type: "logprob",
				channel: "content",
				token: "a",
				logprob: -0.1,
			}),
		).toBe(true);
		expect(isLogprob({ type: "text.delta", text: "x" })).toBe(false);
		expect(isLogprob({ type: "citation", urls: [] })).toBe(false);
	});
});
