import { describe, expect, it } from "vitest";
import { openaiResponsesAdapter } from "../src/adapters/openai-responses";
import { normalizeResponsesRawChunks } from "./helpers/responses-fixtures";

const payload = (value: unknown) => JSON.stringify(value);

describe("openaiResponsesAdapter parseChunk", () => {
	it("LSA-R01: adapter is exported and returns StreamAdapter", () => {
		const adapter = openaiResponsesAdapter();
		expect(typeof adapter.parseChunk).toBe("function");
		expect(typeof adapter.parseResponse).toBe("function");
	});

	it("LSA-R02: DONE returns empty chunks", () => {
		expect(openaiResponsesAdapter().parseChunk("[DONE]")).toEqual([]);
	});

	it("LSA-R03: malformed JSON throws prefixed error", () => {
		expect(() => openaiResponsesAdapter().parseChunk("{")).toThrow(
			/^llm-stream-assemble: openaiResponsesAdapter\.parseChunk/,
		);
	});

	it("LSA-R04: non-object JSON throws prefixed error", () => {
		expect(() => openaiResponsesAdapter().parseChunk("[]")).toThrow(
			/^llm-stream-assemble: openaiResponsesAdapter\.parseChunk/,
		);
	});

	it("LSA-R05: response.created emits message-start and metadata", () => {
		expect(
			normalizeResponsesRawChunks(
				openaiResponsesAdapter().parseChunk(
					payload({
						type: "response.created",
						response: { id: "resp_1", model: "gpt-4.1-mini", created_at: 1 },
					}),
				),
			),
		).toEqual([
			{ kind: "message-start", id: "resp_1" },
			{ kind: "metadata", responseId: "resp_1", model: "gpt-4.1-mini", created: 1 },
		]);
	});

	it("LSA-R06: metadata is emitted once", () => {
		const adapter = openaiResponsesAdapter();
		adapter.parseChunk(payload({ type: "response.created", response: { id: "resp_1" } }));
		expect(
			adapter.parseChunk(payload({ type: "response.in_progress", response: { id: "resp_1" } })),
		).toEqual([]);
	});

	it("LSA-R07: output_text.delta maps text-delta", () => {
		expect(
			openaiResponsesAdapter().parseChunk(
				payload({ type: "response.output_text.delta", delta: "hi" }),
			),
		).toEqual([{ kind: "text-delta", text: "hi" }]);
	});

	it("LSA-R08: output_text.done does not duplicate text", () => {
		const adapter = openaiResponsesAdapter();
		adapter.parseChunk(payload({ type: "response.output_text.delta", delta: "hi" }));
		expect(adapter.parseChunk(payload({ type: "response.output_text.done", text: "hi" }))).toEqual(
			[],
		);
	});

	it("LSA-R08b: output_text.done emits text when no delta was seen", () => {
		expect(
			openaiResponsesAdapter().parseChunk(
				payload({ type: "response.output_text.done", text: "hi" }),
			),
		).toEqual([{ kind: "text-delta", text: "hi" }]);
	});

	it("LSA-R09: refusal.delta maps refusal-delta", () => {
		expect(
			openaiResponsesAdapter().parseChunk(payload({ type: "response.refusal.delta", delta: "no" })),
		).toEqual([{ kind: "refusal-delta", text: "no" }]);
	});

	it("LSA-R10: usage maps input output and reasoning tokens", () => {
		expect(
			normalizeResponsesRawChunks(
				openaiResponsesAdapter().parseChunk(
					payload({
						type: "response.completed",
						response: {
							usage: {
								input_tokens: 1,
								output_tokens: 2,
								output_tokens_details: { reasoning_tokens: 3 },
							},
						},
					}),
				),
			),
		).toContainEqual({ kind: "usage", inputTokens: 1, outputTokens: 2, reasoningTokens: 3 });
	});

	it("LSA-R10b: jsonMode maps output_text.delta to json-delta", () => {
		expect(
			openaiResponsesAdapter({ jsonMode: true }).parseChunk(
				payload({ type: "response.output_text.delta", delta: '{"a":' }),
			),
		).toEqual([{ kind: "json-delta", delta: '{"a":' }]);
	});

	it("LSA-R10c: reasoning string fields map to reasoning deltas", () => {
		expect(
			openaiResponsesAdapter().parseChunk(payload({ type: "response.reasoning", summary: "sum" })),
		).toEqual([{ kind: "reasoning-delta", text: "sum", variant: "summary" }]);
	});
});
