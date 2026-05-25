import { describe, expect, it } from "vitest";
import { openaiChatAdapter } from "../src/adapters/openai-chat";

const payload = (value: unknown) => JSON.stringify(value);

describe("openaiChatAdapter refusal and reasoning", () => {
	it("LSA-O28: maps delta.refusal to refusal-delta", () => {
		expect(
			openaiChatAdapter().parseChunk(
				payload({ choices: [{ index: 0, delta: { refusal: "No thanks." } }] }),
			),
		).toEqual([{ kind: "refusal-delta", text: "No thanks." }]);
	});

	it("LSA-O29: maps delta.reasoning to detail reasoning", () => {
		expect(
			openaiChatAdapter().parseChunk(
				payload({ choices: [{ index: 0, delta: { reasoning: "thinking" } }] }),
			),
		).toEqual([{ kind: "reasoning-delta", text: "thinking", variant: "detail" }]);
	});

	it("LSA-O30: maps delta.reasoning_content to detail reasoning", () => {
		expect(
			openaiChatAdapter().parseChunk(
				payload({ choices: [{ index: 0, delta: { reasoning_content: "details" } }] }),
			),
		).toEqual([{ kind: "reasoning-delta", text: "details", variant: "detail" }]);
	});

	it("LSA-O31: maps delta.reasoning_summary to summary reasoning", () => {
		expect(
			openaiChatAdapter().parseChunk(
				payload({ choices: [{ index: 0, delta: { reasoning_summary: "summary" } }] }),
			),
		).toEqual([{ kind: "reasoning-delta", text: "summary", variant: "summary" }]);
	});
});
