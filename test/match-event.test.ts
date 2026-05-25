import { describe, expect, it } from "vitest";
import { matchEvent } from "../src/index";
import type { StreamEvent, StreamEventType } from "../src/core/types";
import { sampleEvents } from "./fixtures/sample-events";

const handlerCases: Array<{
	id: string;
	type: StreamEventType;
	event: StreamEvent;
}> = [
	{ id: "LSA-M01", type: "message.start", event: sampleEvents.messageStart },
	{ id: "LSA-M02", type: "metadata", event: sampleEvents.metadata },
	{ id: "LSA-M03", type: "text.delta", event: sampleEvents.textDelta },
	{ id: "LSA-M04", type: "text.done", event: sampleEvents.textDone },
	{ id: "LSA-M05", type: "reasoning.delta", event: sampleEvents.reasoningDelta },
	{ id: "LSA-M06", type: "reasoning.done", event: sampleEvents.reasoningDone },
	{ id: "LSA-M07", type: "refusal.delta", event: sampleEvents.refusalDelta },
	{ id: "LSA-M08", type: "refusal.done", event: sampleEvents.refusalDone },
	{ id: "LSA-M09", type: "json.delta", event: sampleEvents.jsonDelta },
	{ id: "LSA-M10", type: "json.done", event: sampleEvents.jsonDone },
	{ id: "LSA-M11", type: "tool_call.start", event: sampleEvents.toolCallStart },
	{ id: "LSA-M12", type: "tool_call.args.delta", event: sampleEvents.toolCallArgsDelta },
	{ id: "LSA-M13", type: "tool_call.done", event: sampleEvents.toolCallDone },
	{ id: "LSA-M14", type: "usage", event: sampleEvents.usage },
	{ id: "LSA-M15", type: "finish", event: sampleEvents.finishStop },
	{ id: "LSA-M16", type: "error", event: sampleEvents.error },
];

describe("match-event.test.ts", () => {
	describe.each(handlerCases)("$id dispatches $type handler", ({ type, event }) => {
		it("invokes the matching handler and returns its value", () => {
			const result = matchEvent(event, {
				[type]: (e) => e,
			} as Record<StreamEventType, (e: StreamEvent) => StreamEvent>);

			expect(result).toEqual(event);
		});

		it("returns undefined when handler for this type is omitted", () => {
			const result = matchEvent(event, {});
			expect(result).toBeUndefined();
		});
	});

	it("LSA-M17: passes typed payload fields to text.delta handler", () => {
		let captured = "";
		matchEvent(sampleEvents.textDelta, {
			"text.delta": (e) => {
				captured = e.text;
			},
		});
		expect(captured).toBe("hello 🌍");
	});

	it("LSA-M18: finish handlers receive all finish reason variants", () => {
		const reasons: string[] = [];
		const finishEvents = [
			sampleEvents.finishStop,
			sampleEvents.finishToolCalls,
			sampleEvents.finishLength,
			sampleEvents.finishContentFilter,
			sampleEvents.finishError,
			sampleEvents.finishIncomplete,
			sampleEvents.finishAborted,
		];

		for (const event of finishEvents) {
			matchEvent(event, {
				finish: (e) => {
					reasons.push(e.reason);
				},
			});
		}

		expect(reasons).toEqual([
			"stop",
			"tool_calls",
			"length",
			"content_filter",
			"error",
			"incomplete",
			"aborted",
		]);
	});

	it("LSA-M19: does not invoke unrelated handlers", () => {
		let textHandlerCalls = 0;
		matchEvent(sampleEvents.toolCallDone, {
			"text.delta": () => {
				textHandlerCalls += 1;
			},
		});
		expect(textHandlerCalls).toBe(0);
	});
});
