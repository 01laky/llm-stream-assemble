import type { StreamEvent } from "../../src/core/types";

/** Representative StreamEvent for each union member — used in edge-case tests. */
export const sampleEvents = {
	messageStart: { type: "message.start", id: "msg_1", choiceIndex: 0 } satisfies StreamEvent,
	metadata: {
		type: "metadata",
		model: "gpt-4o",
		responseId: "resp_1",
		created: 1_700_000_000,
	} satisfies StreamEvent,
	textDelta: { type: "text.delta", text: "hello 🌍", choiceIndex: 0 } satisfies StreamEvent,
	textDone: { type: "text.done", text: "hello 🌍", choiceIndex: 0 } satisfies StreamEvent,
	reasoningDelta: {
		type: "reasoning.delta",
		text: "thinking…",
		variant: "detail",
	} satisfies StreamEvent,
	reasoningDone: {
		type: "reasoning.done",
		text: "thinking…",
		variant: "summary",
	} satisfies StreamEvent,
	refusalDelta: { type: "refusal.delta", text: "I cannot" } satisfies StreamEvent,
	refusalDone: { type: "refusal.done", text: "I cannot help" } satisfies StreamEvent,
	jsonDelta: { type: "json.delta", delta: '{"a":', partial: undefined } satisfies StreamEvent,
	jsonDone: { type: "json.done", value: { a: 1 } } satisfies StreamEvent,
	toolCallStart: {
		type: "tool_call.start",
		id: "call_1",
		name: "get_weather",
		index: 0,
		choiceIndex: 0,
	} satisfies StreamEvent,
	toolCallArgsDelta: {
		type: "tool_call.args.delta",
		id: "call_1",
		delta: '{"city":',
		partial: { city: "Br" },
	} satisfies StreamEvent,
	toolCallDone: {
		type: "tool_call.done",
		id: "call_1",
		name: "get_weather",
		args: { city: "Bratislava" },
	} satisfies StreamEvent,
	usage: {
		type: "usage",
		inputTokens: 10,
		outputTokens: 20,
		reasoningTokens: 5,
	} satisfies StreamEvent,
	finishStop: { type: "finish", reason: "stop", choiceIndex: 0 } satisfies StreamEvent,
	finishToolCalls: { type: "finish", reason: "tool_calls" } satisfies StreamEvent,
	finishLength: { type: "finish", reason: "length" } satisfies StreamEvent,
	finishContentFilter: { type: "finish", reason: "content_filter" } satisfies StreamEvent,
	finishError: { type: "finish", reason: "error" } satisfies StreamEvent,
	finishIncomplete: { type: "finish", reason: "incomplete" } satisfies StreamEvent,
	finishAborted: { type: "finish", reason: "aborted" } satisfies StreamEvent,
	error: {
		type: "error",
		error: new Error("provider failed"),
		recoverable: true,
		sanitized: "Something went wrong",
	} satisfies StreamEvent,
} as const;

export const allSampleEvents: StreamEvent[] = Object.values(sampleEvents);

export const NOT_IMPLEMENTED_PATTERN = /not implemented yet/i;
