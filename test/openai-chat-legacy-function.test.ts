import { describe, expect, it } from "vitest";
import { openaiChatAdapter } from "../src/adapters/openai-chat";
import { assembleStream } from "../src/core/assemble-stream";
import { collectAsync, strings } from "./helpers/collect-events";
import { normalizeEvents } from "./helpers/openai-fixtures";

const payload = (value: unknown) => JSON.stringify(value);

describe("openaiChatAdapter legacy function_call", () => {
	it("LSA-O17: legacy function_call.name emits synthetic tool start", () => {
		expect(
			openaiChatAdapter().parseChunk(
				payload({ choices: [{ index: 0, delta: { function_call: { name: "legacy" } } }] }),
			),
		).toEqual([
			{ kind: "tool-start", id: "legacy_function:0", name: "legacy", index: 0, choiceIndex: 0 },
		]);
	});

	it("LSA-O18: legacy function_call.arguments emits args delta", () => {
		const adapter = openaiChatAdapter();
		adapter.parseChunk(
			payload({ choices: [{ index: 0, delta: { function_call: { name: "legacy" } } }] }),
		);
		expect(
			adapter.parseChunk(
				payload({ choices: [{ index: 0, delta: { function_call: { arguments: '{"x":1}' } } }] }),
			),
		).toEqual([
			{
				kind: "tool-args-delta",
				id: "legacy_function:0",
				delta: '{"x":1}',
				index: 0,
				choiceIndex: 0,
			},
		]);
	});

	it("LSA-O19: legacy fragmented args assemble through core", async () => {
		const adapter = openaiChatAdapter();
		const events = await collectAsync(
			assembleStream(
				strings(
					`data: ${payload({ choices: [{ index: 0, delta: { function_call: { name: "legacy", arguments: '{"x":' } }, finish_reason: null }] })}\n\n`,
					`data: ${payload({ choices: [{ index: 0, delta: { function_call: { arguments: "1}" } }, finish_reason: "function_call" }] })}\n\n`,
					"data: [DONE]\n\n",
				),
				adapter,
			),
		);
		expect(normalizeEvents(events)).toContainEqual({
			type: "tool_call.done",
			id: "legacy_function:0",
			name: "legacy",
			args: { x: 1 },
		});
	});

	it("LSA-O20: legacy finish_reason function_call maps to tool_calls", () => {
		expect(
			openaiChatAdapter().parseChunk(
				payload({ choices: [{ index: 0, delta: {}, finish_reason: "function_call" }] }),
			),
		).toEqual([{ kind: "finish", reason: "tool_calls", choiceIndex: 0 }]);
	});
});
