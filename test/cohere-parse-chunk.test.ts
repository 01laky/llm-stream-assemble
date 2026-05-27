import { describe, expect, it } from "vitest";
import { cohereAdapter } from "../src/adapters/cohere";

const payload = (value: unknown) => JSON.stringify(value);

describe("cohereAdapter parseChunk unit", () => {
	it("LSA-CO01: message-start emits message-start and metadata", () => {
		expect(
			cohereAdapter().parseChunk(
				payload({
					type: "message-start",
					id: "msg_1",
					delta: { message: { role: "assistant" } },
				}),
			),
		).toEqual([
			{ kind: "message-start" },
			{ kind: "metadata", responseId: "msg_1", raw: { id: "msg_1", role: "assistant" } },
		]);
	});

	it("LSA-CO02: content-delta text emits text-delta", () => {
		expect(
			cohereAdapter().parseChunk(
				payload({
					type: "content-delta",
					index: 0,
					delta: { message: { content: { text: "Hi" } } },
				}),
			),
		).toEqual([{ kind: "text-delta", text: "Hi", choiceIndex: 0 }]);
	});

	it("LSA-CO03: tool-plan-delta emits reasoning-delta detail", () => {
		expect(
			cohereAdapter().parseChunk(
				payload({
					type: "tool-plan-delta",
					delta: { message: { tool_plan: "I will search" } },
				}),
			),
		).toEqual([{ kind: "reasoning-delta", text: "I will search", variant: "detail" }]);
	});

	it("LSA-CO04: tool-call-start emits tool-start with id and name", () => {
		expect(
			cohereAdapter().parseChunk(
				payload({
					type: "tool-call-start",
					index: 0,
					delta: {
						message: {
							tool_calls: {
								id: "tool_x",
								type: "function",
								function: { name: "search", arguments: "" },
							},
						},
					},
				}),
			),
		).toEqual([{ kind: "tool-start", id: "tool_x", name: "search", index: 0, choiceIndex: 0 }]);
	});

	it("LSA-CO05: tool-call-delta emits tool-args-delta on open tool", () => {
		const adapter = cohereAdapter();
		adapter.parseChunk(
			payload({
				type: "tool-call-start",
				index: 0,
				delta: {
					message: {
						tool_calls: {
							id: "t1",
							type: "function",
							function: { name: "merge", arguments: "" },
						},
					},
				},
			}),
		);
		expect(
			adapter.parseChunk(
				payload({
					type: "tool-call-delta",
					index: 0,
					delta: {
						message: {
							tool_calls: {
								function: { arguments: '{"q":' },
							},
						},
					},
				}),
			),
		).toEqual([
			{
				kind: "tool-args-delta",
				id: "t1",
				delta: '{"q":',
				index: 0,
				choiceIndex: 0,
			},
		]);
	});

	it("LSA-CO06: tool-call-end closes open tool with tool-done", () => {
		const adapter = cohereAdapter();
		adapter.parseChunk(
			payload({
				type: "tool-call-start",
				index: 0,
				delta: {
					message: {
						tool_calls: {
							id: "t_close",
							type: "function",
							function: { name: "fn", arguments: "" },
						},
					},
				},
			}),
		);
		expect(adapter.parseChunk(payload({ type: "tool-call-end", index: 0 }))).toEqual([
			{ kind: "tool-done", id: "t_close", index: 0, choiceIndex: 0 },
		]);
	});

	it("LSA-CO07: citation-start emits citation payload", () => {
		expect(
			cohereAdapter().parseChunk(
				payload({
					type: "citation-start",
					index: 0,
					delta: { message: { citations: { start: 0, end: 4, text: "cite" } } },
				}),
			),
		).toEqual([
			{
				kind: "citation",
				index: 0,
				span: { start: 0, end: 4, text: "cite" },
				raw: { citation: { start: 0, end: 4, text: "cite" }, index: 0 },
			},
		]);
	});

	it("LSA-CO08: message-end emits usage, finish metadata, and finish chunk", () => {
		expect(
			cohereAdapter().parseChunk(
				payload({
					type: "message-end",
					delta: {
						finish_reason: "COMPLETE",
						usage: {
							billed_units: { input_tokens: 12, output_tokens: 4 },
						},
					},
				}),
			),
		).toEqual([
			{
				kind: "usage",
				inputTokens: 12,
				outputTokens: 4,
				raw: { input_tokens: 12, output_tokens: 4 },
			},
			{ kind: "metadata", raw: { finish_reason: "COMPLETE" } },
			{ kind: "finish", reason: "stop", choiceIndex: 0 },
		]);
	});

	it("LSA-CO09: type error emits provider-error chunks", () => {
		const chunks = cohereAdapter().parseChunk(
			payload({ type: "error", error: { message: "Overloaded" } }),
		);
		expect(chunks).toHaveLength(2);
		expect(chunks[0]?.kind).toBe("provider-error");
		expect(chunks[1]).toEqual({ kind: "finish", reason: "error" });
	});

	it("LSA-CO10: jsonMode maps content-delta text to json-delta", () => {
		expect(
			cohereAdapter({ jsonMode: true }).parseChunk(
				payload({
					type: "content-delta",
					index: 0,
					delta: { message: { content: { text: '{"k":' } } },
				}),
			),
		).toEqual([{ kind: "json-delta", delta: '{"k":' }]);
	});
});
