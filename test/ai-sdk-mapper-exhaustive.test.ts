import { describe, expect, it } from "vitest";
import type { StreamEvent } from "../src/core/types";
import { openaiResponsesAdapter } from "../src/adapters/openai-responses";
import { mapFixtureEventsToAISDKParts } from "../examples/integrations/replay-integration-mapper";
import { mapStreamEventToAISDKPart } from "../examples/integrations/stream-event-to-ai-sdk-parts";

type MapperRow = {
	event: StreamEvent;
	expectedType: string | null;
};

describe("ai-sdk mapper exhaustive coverage", () => {
	const rows: MapperRow[] = [
		{ event: { type: "text.delta", text: "hello" }, expectedType: "text-delta" },
		{
			event: { type: "tool_call.done", id: "t1", name: "lookup", args: { q: "x" } },
			expectedType: "tool-call",
		},
		{ event: { type: "citation", urls: ["https://a.test"] }, expectedType: "citation" },
		{ event: { type: "grounding", queries: ["q"] }, expectedType: "grounding" },
		{
			event: { type: "logprob", channel: "content", token: "a", logprob: -0.1 },
			expectedType: "token-logprob",
		},
		{ event: { type: "finish", reason: "stop" }, expectedType: "finish" },
		{
			event: { type: "error", error: new Error("x"), recoverable: true, sanitized: "safe" },
			expectedType: "error",
		},
		{ event: { type: "text.done", text: "done" }, expectedType: null },
		{ event: { type: "json.delta", delta: "{}" }, expectedType: null },
		{ event: { type: "json.done", value: { ok: true } }, expectedType: null },
		{ event: { type: "reasoning.delta", text: "r" }, expectedType: null },
		{ event: { type: "reasoning.done", text: "r" }, expectedType: null },
		{ event: { type: "refusal.delta", text: "no" }, expectedType: null },
		{ event: { type: "refusal.done", text: "no" }, expectedType: null },
		{ event: { type: "message.start", id: "m1" }, expectedType: null },
		{ event: { type: "tool_call.start", id: "t2", name: "fn" }, expectedType: null },
		{ event: { type: "tool_call.args.delta", id: "t2", delta: "{}" }, expectedType: null },
		{ event: { type: "usage", inputTokens: 1, outputTokens: 2 }, expectedType: null },
		{
			event: { type: "usage", inputTokens: 1, outputTokens: 2, reasoningTokens: 3 },
			expectedType: null,
		},
		{ event: { type: "finish", reason: "error" }, expectedType: "finish" },
		{
			event: { type: "error", error: new Error("x"), recoverable: false },
			expectedType: "error",
		},
		{
			event: { type: "citation", sources: [{ id: "s1" }], urls: ["https://b.test"] },
			expectedType: "citation",
		},
		{
			event: { type: "logprob", channel: "refusal", token: "no", logprob: -2.4 },
			expectedType: "token-logprob",
		},
	];
	const gatedRows = rows.map((row, index) => ({
		...row,
		gate: `LSA-INT${121 + index}`,
	}));

	it.each(gatedRows)("$gate mapStreamEventToAISDKPart type mapping", ({ event, expectedType }) => {
		const mapped = mapStreamEventToAISDKPart(event);
		if (expectedType === null) {
			expect(mapped).toBeNull();
			return;
		}
		expect(mapped).not.toBeNull();
		const first = Array.isArray(mapped) ? mapped[0] : mapped;
		expect(first.type).toBe(expectedType);
	});

	it("LSA-RP31: replay mapper supports Responses logprobs fixture with custom adapter", async () => {
		const parts = await mapFixtureEventsToAISDKParts({
			fixturePath: "test/fixtures/openai-responses/logprobs-stream.sse",
			adapter: openaiResponsesAdapter(),
		});
		expect(parts.some((part) => (part as { type?: string }).type === "token-logprob")).toBe(true);
		expect(parts.some((part) => (part as { type?: string }).type === "finish")).toBe(true);
	});

	it("LSA-MAINT50: exhaustive mapper matrix keeps >= 20 canonical input rows", () => {
		expect(rows.length).toBeGreaterThanOrEqual(20);
		expect(rows.some((row) => row.expectedType === null)).toBe(true);
		expect(rows.some((row) => row.expectedType === "token-logprob")).toBe(true);
	});
});
