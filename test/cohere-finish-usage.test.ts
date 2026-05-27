import { describe, expect, it } from "vitest";
import { cohereAdapter } from "../src/adapters/cohere";

const payload = (value: unknown) => JSON.stringify(value);

describe("cohereAdapter finish and usage", () => {
	it("LSA-CO38: message-end COMPLETE maps finish stop", () => {
		expect(
			cohereAdapter().parseChunk(
				payload({ type: "message-end", delta: { finish_reason: "COMPLETE" } }),
			),
		).toContainEqual({ kind: "finish", reason: "stop", choiceIndex: 0 });
	});

	it("LSA-CO39: message-end STOP_SEQUENCE maps finish stop", () => {
		expect(
			cohereAdapter().parseChunk(
				payload({ type: "message-end", delta: { finish_reason: "STOP_SEQUENCE" } }),
			),
		).toContainEqual({ kind: "finish", reason: "stop", choiceIndex: 0 });
	});

	it("LSA-CO40: message-end TOOL_CALL maps finish tool_calls", () => {
		expect(
			cohereAdapter().parseChunk(
				payload({ type: "message-end", delta: { finish_reason: "TOOL_CALL" } }),
			),
		).toContainEqual({ kind: "finish", reason: "tool_calls", choiceIndex: 0 });
	});

	it("LSA-CO41: message-end MAX_TOKENS maps finish length", () => {
		expect(
			cohereAdapter().parseChunk(
				payload({ type: "message-end", delta: { finish_reason: "MAX_TOKENS" } }),
			),
		).toContainEqual({ kind: "finish", reason: "length", choiceIndex: 0 });
	});

	it("LSA-CO42: message-end ERROR maps finish error", () => {
		expect(
			cohereAdapter().parseChunk(
				payload({ type: "message-end", delta: { finish_reason: "ERROR" } }),
			),
		).toContainEqual({ kind: "finish", reason: "error", choiceIndex: 0 });
	});

	it("LSA-CO43: message-end TIMEOUT maps finish error", () => {
		expect(
			cohereAdapter().parseChunk(
				payload({ type: "message-end", delta: { finish_reason: "TIMEOUT" } }),
			),
		).toContainEqual({ kind: "finish", reason: "error", choiceIndex: 0 });
	});

	it("LSA-CO44: unknown finish_reason maps finish stop and preserves raw metadata", () => {
		const chunks = cohereAdapter().parseChunk(
			payload({
				type: "message-end",
				delta: { finish_reason: "MODEL_CONTEXT_WINDOW_EXCEEDED" },
			}),
		);
		expect(chunks).toContainEqual({ kind: "finish", reason: "stop", choiceIndex: 0 });
		expect(chunks).toContainEqual({
			kind: "metadata",
			raw: { finish_reason: "MODEL_CONTEXT_WINDOW_EXCEEDED" },
		});
	});

	it("LSA-CO45: message-end usage billed_units maps inputTokens and outputTokens", () => {
		expect(
			cohereAdapter().parseChunk(
				payload({
					type: "message-end",
					delta: {
						finish_reason: "COMPLETE",
						usage: {
							billed_units: { input_tokens: 12, output_tokens: 4, total_tokens: 16 },
						},
					},
				}),
			),
		).toContainEqual({
			kind: "usage",
			inputTokens: 12,
			outputTokens: 4,
			raw: { input_tokens: 12, output_tokens: 4, total_tokens: 16 },
		});
	});

	it("LSA-CO46: message-end usage tokens alias maps snake_case counts", () => {
		expect(
			cohereAdapter().parseChunk(
				payload({
					type: "message-end",
					delta: {
						usage: {
							tokens: { input_tokens: 3, output_tokens: 2, total_tokens: 5 },
						},
					},
				}),
			),
		).toContainEqual({
			kind: "usage",
			inputTokens: 3,
			outputTokens: 2,
			raw: { input_tokens: 3, output_tokens: 2, total_tokens: 5 },
		});
	});

	it("LSA-CO47: message-end usage accepts inputTokens and outputTokens camelCase aliases", () => {
		expect(
			cohereAdapter().parseChunk(
				payload({
					type: "message-end",
					delta: {
						usage: {
							billed_units: { inputTokens: 7, outputTokens: 2, totalTokens: 9 },
						},
					},
				}),
			),
		).toContainEqual({
			kind: "usage",
			inputTokens: 7,
			outputTokens: 2,
			raw: { inputTokens: 7, outputTokens: 2, totalTokens: 9 },
		});
	});

	it("LSA-CO48: message-end finish_reason preserved in metadata raw", () => {
		expect(
			cohereAdapter().parseChunk(
				payload({
					type: "message-end",
					delta: {
						finish_reason: "TOOL_CALL",
						usage: { billed_units: { input_tokens: 1, output_tokens: 1 } },
					},
				}),
			),
		).toContainEqual({
			kind: "metadata",
			raw: { finish_reason: "TOOL_CALL" },
		});
	});
});
