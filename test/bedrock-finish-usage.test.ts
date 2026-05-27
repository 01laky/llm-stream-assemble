import { describe, expect, it } from "vitest";
import { bedrockAdapter } from "../src/adapters/bedrock";

const payload = (value: unknown) => JSON.stringify(value);

describe("bedrockAdapter finish and usage", () => {
	it("LSA-B38: messageStop end_turn maps finish stop", () => {
		expect(
			bedrockAdapter().parseChunk(payload({ messageStop: { stopReason: "end_turn" } })),
		).toContainEqual({ kind: "finish", reason: "stop", choiceIndex: 0 });
	});

	it("LSA-B39: messageStop stop_sequence maps finish stop", () => {
		expect(
			bedrockAdapter().parseChunk(payload({ messageStop: { stopReason: "stop_sequence" } })),
		).toContainEqual({ kind: "finish", reason: "stop", choiceIndex: 0 });
	});

	it("LSA-B40: messageStop tool_use maps finish tool_calls", () => {
		expect(
			bedrockAdapter().parseChunk(payload({ messageStop: { stopReason: "tool_use" } })),
		).toContainEqual({ kind: "finish", reason: "tool_calls", choiceIndex: 0 });
	});

	it("LSA-B41: messageStop max_tokens maps finish length", () => {
		expect(
			bedrockAdapter().parseChunk(payload({ messageStop: { stopReason: "max_tokens" } })),
		).toContainEqual({ kind: "finish", reason: "length", choiceIndex: 0 });
	});

	it("LSA-B42: messageStop content_filtered maps finish content_filter", () => {
		expect(
			bedrockAdapter().parseChunk(payload({ messageStop: { stopReason: "content_filtered" } })),
		).toContainEqual({ kind: "finish", reason: "content_filter", choiceIndex: 0 });
	});

	it("LSA-B43: messageStop guardrail_intervened maps finish content_filter", () => {
		expect(
			bedrockAdapter().parseChunk(payload({ messageStop: { stopReason: "guardrail_intervened" } })),
		).toContainEqual({ kind: "finish", reason: "content_filter", choiceIndex: 0 });
	});

	it("LSA-B44: unknown stopReason maps finish stop and preserves raw metadata", () => {
		const chunks = bedrockAdapter().parseChunk(
			payload({ messageStop: { stopReason: "model_context_window_exceeded" } }),
		);
		expect(chunks).toContainEqual({ kind: "finish", reason: "stop", choiceIndex: 0 });
		expect(chunks).toContainEqual({
			kind: "metadata",
			raw: { stopReason: "model_context_window_exceeded" },
		});
	});

	it("LSA-B45: metadata usage maps inputTokens and outputTokens", () => {
		expect(
			bedrockAdapter().parseChunk(
				payload({
					metadata: {
						usage: { inputTokens: 12, outputTokens: 4, totalTokens: 16 },
					},
				}),
			),
		).toEqual([
			{
				kind: "usage",
				inputTokens: 12,
				outputTokens: 4,
				raw: { inputTokens: 12, outputTokens: 4, totalTokens: 16 },
			},
		]);
	});

	it("LSA-B46: metadata usage accepts promptTokens and completionTokens aliases", () => {
		expect(
			bedrockAdapter().parseChunk(
				payload({
					metadata: {
						usage: { promptTokens: 3, completionTokens: 2, totalTokenCount: 5 },
					},
				}),
			),
		).toEqual([
			{
				kind: "usage",
				inputTokens: 3,
				outputTokens: 2,
				raw: { promptTokens: 3, completionTokens: 2, totalTokenCount: 5, totalTokens: 5 },
			},
		]);
	});

	it("LSA-B47: metadata metrics and trace preserved in raw", () => {
		expect(
			bedrockAdapter().parseChunk(
				payload({
					metadata: {
						metrics: { latencyMs: 42 },
						trace: { guardrail: { actionReason: "blocked" } },
					},
				}),
			),
		).toEqual([
			{
				kind: "metadata",
				raw: {
					metrics: { latencyMs: 42 },
					trace: { guardrail: { actionReason: "blocked" } },
				},
			},
		]);
	});

	it("LSA-B48: messageStop additionalModelResponseFields preserved in metadata raw", () => {
		expect(
			bedrockAdapter().parseChunk(
				payload({
					messageStop: {
						stopReason: "end_turn",
						additionalModelResponseFields: { custom: true },
					},
				}),
			),
		).toContainEqual({
			kind: "metadata",
			raw: {
				stopReason: "end_turn",
				additionalModelResponseFields: { custom: true },
			},
		});
	});
});
