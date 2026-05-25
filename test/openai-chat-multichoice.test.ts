import { describe, expect, it } from "vitest";
import { openaiChatAdapter } from "../src/adapters/openai-chat";

const payload = (value: unknown) => JSON.stringify(value);

describe("openaiChatAdapter multi-choice", () => {
	it("LSA-O32: preserves choiceIndex on text chunks", () => {
		expect(
			openaiChatAdapter().parseChunk(
				payload({
					choices: [
						{ index: 0, delta: { content: "a" } },
						{ index: 1, delta: { content: "b" } },
					],
				}),
			),
		).toEqual([
			{ kind: "text-delta", text: "a", choiceIndex: 0 },
			{ kind: "text-delta", text: "b", choiceIndex: 1 },
		]);
	});

	it("LSA-O33: preserves choiceIndex on tool calls", () => {
		expect(
			openaiChatAdapter().parseChunk(
				payload({
					choices: [
						{
							index: 1,
							delta: { tool_calls: [{ index: 0, id: "call_1", function: { name: "fn" } }] },
						},
					],
				}),
			),
		).toEqual([{ kind: "tool-start", id: "call_1", name: "fn", index: 0, choiceIndex: 1 }]);
	});

	it("LSA-O34: preserves choiceIndex on finish chunks", () => {
		expect(
			openaiChatAdapter().parseChunk(
				payload({
					choices: [
						{ index: 0, finish_reason: "stop" },
						{ index: 1, finish_reason: "length" },
					],
				}),
			),
		).toEqual([
			{ kind: "finish", reason: "stop", choiceIndex: 0 },
			{ kind: "finish", reason: "length", choiceIndex: 1 },
		]);
	});
});
