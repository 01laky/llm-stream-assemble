import { describe, expect, it } from "vitest";
import { openaiCompatibleAdapter } from "../src/adapters/openai-compatible";
import { normalizeCompatibleRawChunks } from "./helpers/compatible-fixtures";

const payload = (value: unknown) => JSON.stringify(value);

describe("openaiCompatibleAdapter reasoning and usage aliases", () => {
	it("LSA-OC20: thinking maps to detail reasoning", () => {
		expect(
			openaiCompatibleAdapter().parseChunk(
				payload({ choices: [{ delta: { thinking: "think" } }] }),
			),
		).toEqual([{ kind: "reasoning-delta", text: "think", variant: "detail" }]);
	});

	it("LSA-OC21: thinking_content maps to detail reasoning", () => {
		expect(
			openaiCompatibleAdapter().parseChunk(
				payload({ choices: [{ delta: { thinking_content: "content" } }] }),
			),
		).toEqual([{ kind: "reasoning-delta", text: "content", variant: "detail" }]);
	});

	it("LSA-OC22: custom reasoningFieldAliases maps configured string field", () => {
		expect(
			openaiCompatibleAdapter({ reasoningFieldAliases: ["custom_reasoning"] }).parseChunk(
				payload({ choices: [{ delta: { custom_reasoning: "custom" } }] }),
			),
		).toEqual([{ kind: "reasoning-delta", text: "custom", variant: "detail" }]);
	});

	it("LSA-OC23: input_tokens maps to inputTokens", () => {
		expect(
			normalizeCompatibleRawChunks(
				openaiCompatibleAdapter().parseChunk(payload({ usage: { input_tokens: 5 } })),
			),
		).toEqual([{ kind: "usage", inputTokens: 5 }]);
	});

	it("LSA-OC24: output_tokens maps to outputTokens", () => {
		expect(
			normalizeCompatibleRawChunks(
				openaiCompatibleAdapter().parseChunk(payload({ usage: { output_tokens: 8 } })),
			),
		).toEqual([{ kind: "usage", outputTokens: 8 }]);
	});

	it("LSA-OC25: total_tokens remains only in raw usage", () => {
		const chunks = openaiCompatibleAdapter().parseChunk(
			payload({ usage: { input_tokens: 5, output_tokens: 8, total_tokens: 13 } }),
		);
		expect(chunks).toHaveLength(1);
		expect(chunks[0]).toMatchObject({ kind: "usage", inputTokens: 5, outputTokens: 8 });
		expect(JSON.stringify(chunks[0])).toContain("total_tokens");
	});
});
