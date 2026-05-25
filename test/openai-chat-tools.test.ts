import { describe, expect, it } from "vitest";
import { openaiChatAdapter } from "../src/adapters/openai-chat";
import { assembleResponse } from "../src/core/assemble-response";
import { normalizeEvents } from "./helpers/openai-fixtures";

const payload = (value: unknown) => JSON.stringify(value);

describe("openaiChatAdapter tools", () => {
	it("LSA-O09: maps a single tool start with id name index and choiceIndex", () => {
		expect(
			openaiChatAdapter().parseChunk(
				payload({
					choices: [
						{
							index: 2,
							delta: {
								tool_calls: [{ index: 3, id: "call_1", function: { name: "search" } }],
							},
						},
					],
				}),
			),
		).toEqual([
			{
				kind: "tool-start",
				id: "call_1",
				name: "search",
				index: 3,
				choiceIndex: 2,
			},
		]);
	});

	it("LSA-O10: maps a tool args fragment", () => {
		expect(
			openaiChatAdapter().parseChunk(
				payload({
					choices: [
						{
							index: 0,
							delta: {
								tool_calls: [
									{
										index: 0,
										id: "call_1",
										function: { name: "search", arguments: '{"q":"hi' },
									},
								],
							},
						},
					],
				}),
			),
		).toEqual([
			{ kind: "tool-start", id: "call_1", name: "search", index: 0, choiceIndex: 0 },
			{
				kind: "tool-args-delta",
				id: "call_1",
				delta: '{"q":"hi',
				index: 0,
				choiceIndex: 0,
			},
		]);
	});

	it("LSA-O11: args without id use stored id by choice and index", () => {
		const adapter = openaiChatAdapter();
		adapter.parseChunk(
			payload({
				choices: [
					{
						index: 0,
						delta: { tool_calls: [{ index: 0, id: "call_stored", function: { name: "fn" } }] },
					},
				],
			}),
		);
		expect(
			adapter.parseChunk(
				payload({
					choices: [
						{ index: 0, delta: { tool_calls: [{ index: 0, function: { arguments: "{}" } }] } },
					],
				}),
			),
		).toEqual([
			{
				kind: "tool-args-delta",
				id: "call_stored",
				delta: "{}",
				index: 0,
				choiceIndex: 0,
			},
		]);
	});

	it("LSA-O12: parallel tools remain separated by index", () => {
		const chunks = openaiChatAdapter().parseChunk(
			payload({
				choices: [
					{
						index: 0,
						delta: {
							tool_calls: [
								{ index: 0, id: "call_a", function: { name: "a", arguments: '{"a":1}' } },
								{ index: 1, id: "call_b", function: { name: "b", arguments: '{"b":2}' } },
							],
						},
					},
				],
			}),
		);
		expect(chunks.map((chunk) => ("id" in chunk ? chunk.id : undefined)).filter(Boolean)).toEqual([
			"call_a",
			"call_a",
			"call_b",
			"call_b",
		]);
	});

	it("LSA-O13: tool name without args still emits start", () => {
		expect(
			openaiChatAdapter().parseChunk(
				payload({
					choices: [
						{ index: 0, delta: { tool_calls: [{ index: 0, function: { name: "onlyName" } }] } },
					],
				}),
			),
		).toEqual([{ kind: "tool-start", name: "onlyName", index: 0, choiceIndex: 0 }]);
	});

	it("LSA-O14: tool args without name use unknown fallback", () => {
		expect(
			openaiChatAdapter().parseChunk(
				payload({
					choices: [
						{ index: 0, delta: { tool_calls: [{ index: 0, function: { arguments: "{}" } }] } },
					],
				}),
			),
		).toEqual([
			{ kind: "tool-start", name: "unknown", index: 0, choiceIndex: 0 },
			{ kind: "tool-args-delta", delta: "{}", index: 0, choiceIndex: 0 },
		]);
	});

	it("LSA-O15: finish_reason tool_calls emits finish tool_calls", () => {
		expect(
			openaiChatAdapter().parseChunk(
				payload({ choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }] }),
			),
		).toEqual([{ kind: "finish", reason: "tool_calls", choiceIndex: 0 }]);
	});

	it("LSA-O16: non-stream tool call emits start args delta and done", () => {
		const events = assembleResponse(
			{
				id: "chatcmpl_tool",
				model: "gpt-4o-mini",
				choices: [
					{
						index: 0,
						message: {
							tool_calls: [
								{
									id: "call_response",
									function: { name: "lookup", arguments: '{"id":"1"}' },
								},
							],
						},
						finish_reason: "tool_calls",
					},
				],
			},
			openaiChatAdapter(),
		);
		expect(
			normalizeEvents(events).filter((event) => String(event.type).startsWith("tool_call")),
		).toEqual([
			{ type: "tool_call.start", id: "call_response", name: "lookup", index: 0 },
			{
				type: "tool_call.args.delta",
				id: "call_response",
				delta: '{"id":"1"}',
				partial: { id: "1" },
			},
			{ type: "tool_call.done", id: "call_response", name: "lookup", args: { id: "1" } },
		]);
	});
});
