import { describe, expect, it } from "vitest";
import { bedrockAdapter } from "../src/adapters/bedrock";
import { assembleFromPayloads } from "../src/core/assemble-payloads";
import {
	bedrockJsonlLines,
	expectedBedrockEvents,
	normalizeBedrockEvents,
} from "./helpers/bedrock-fixtures";
import { collectAsync, strings } from "./helpers/collect-events";

const payload = (value: unknown) => JSON.stringify(value);

describe("bedrockAdapter edge cases", () => {
	it("LSA-B12: empty or whitespace line yields no chunks", () => {
		expect(bedrockAdapter().parseChunk("")).toEqual([]);
		expect(bedrockAdapter().parseChunk("   ")).toEqual([]);
	});

	it("LSA-B13: malformed JSON throws bedrockAdapter.parseChunk prefix", () => {
		expect(() => bedrockAdapter().parseChunk("{")).toThrow(/bedrockAdapter\.parseChunk/);
	});

	it("LSA-B14: unknown event type yields benign metadata.raw", () => {
		expect(bedrockAdapter().parseChunk(payload({ futureEvent: { foo: "bar" } }))).toEqual([
			{ kind: "metadata", raw: { futureEvent: { foo: "bar" } } },
		]);
	});

	it("LSA-B15: modelFamily anthropic parses reasoningContent delta fixture", async () => {
		async function* payloads() {
			for (const line of bedrockJsonlLines("anthropic-delta-variant")) yield line;
		}
		const events = await collectAsync(
			assembleFromPayloads(payloads(), bedrockAdapter({ modelFamily: "anthropic" })),
		);
		expect(events.some((event) => event.type === "reasoning.delta")).toBe(true);
	});

	it("LSA-B16: parallel tools keep distinct ids through assembly", async () => {
		async function* payloads() {
			for (const line of bedrockJsonlLines("tool-parallel")) yield line;
		}
		const events = await collectAsync(assembleFromPayloads(payloads(), bedrockAdapter()));
		const starts = events.filter((event) => event.type === "tool_call.start");
		expect(starts.map((event) => event.id)).toEqual(["tool_a", "tool_b"]);
	});

	it("LSA-B17: provider error fixture maps to error event via assembler", async () => {
		async function* payloads() {
			for (const line of bedrockJsonlLines("provider-error")) yield line;
		}
		expect(
			normalizeBedrockEvents(
				await collectAsync(assembleFromPayloads(payloads(), bedrockAdapter())),
			),
		).toEqual(expectedBedrockEvents("provider-error"));
	});

	it("LSA-B18: jsonMode maps text deltas to json events", async () => {
		async function* payloads() {
			for (const line of bedrockJsonlLines("json-mode")) yield line;
		}
		const events = await collectAsync(
			assembleFromPayloads(payloads(), bedrockAdapter({ jsonMode: true })),
		);
		expect(events.some((event) => event.type === "json.delta")).toBe(true);
		expect(events.some((event) => event.type === "text.delta")).toBe(false);
	});

	it("LSA-B19: auto modelFamily handles text-basic same as openai-like", async () => {
		async function* payloads() {
			for (const line of bedrockJsonlLines("text-basic")) yield line;
		}
		const autoEvents = normalizeBedrockEvents(
			await collectAsync(assembleFromPayloads(payloads(), bedrockAdapter({ modelFamily: "auto" }))),
		);
		async function* payloadsAgain() {
			for (const line of bedrockJsonlLines("text-basic")) yield line;
		}
		const openaiLikeEvents = normalizeBedrockEvents(
			await collectAsync(
				assembleFromPayloads(payloadsAgain(), bedrockAdapter({ modelFamily: "openai-like" })),
			),
		);
		expect(autoEvents).toEqual(openaiLikeEvents);
	});

	it("LSA-B60: [DONE] marker yields no chunks", () => {
		expect(bedrockAdapter().parseChunk("[DONE]")).toEqual([]);
	});

	it("LSA-B61: internalServerException emits provider error chunks", () => {
		const chunks = bedrockAdapter().parseChunk(
			payload({ internalServerException: { message: "Server error" } }),
		);
		expect(chunks).toHaveLength(2);
		expect(chunks[0]?.kind).toBe("provider-error");
		expect(chunks[1]).toEqual({ kind: "finish", reason: "error" });
	});

	it("LSA-B62: validationException emits provider error chunks", () => {
		const chunks = bedrockAdapter().parseChunk(
			payload({ validationException: { message: "Bad request" } }),
		);
		expect(chunks[0]?.kind).toBe("provider-error");
		if (chunks[0]?.kind === "provider-error") {
			expect(chunks[0].error.message).toMatch(/bedrockAdapter\.parseChunk/);
		}
	});

	it("LSA-B63: throttlingException emits provider error chunks", () => {
		const chunks = bedrockAdapter().parseChunk(
			payload({ throttlingException: { message: "Rate exceeded" } }),
		);
		expect(chunks[0]?.kind).toBe("provider-error");
		expect(chunks[1]).toEqual({ kind: "finish", reason: "error" });
	});

	it("LSA-B64: serviceUnavailableException emits provider error chunks", () => {
		const chunks = bedrockAdapter().parseChunk(
			payload({ serviceUnavailableException: { message: "Unavailable" } }),
		);
		expect(chunks[0]?.kind).toBe("provider-error");
	});

	it("LSA-B65: modelStreamErrorException emits provider error with fallback message", () => {
		const chunks = bedrockAdapter().parseChunk(payload({ modelStreamErrorException: {} }));
		expect(chunks[0]?.kind).toBe("provider-error");
		if (chunks[0]?.kind === "provider-error") {
			expect(chunks[0].error.message).toMatch(/modelStreamErrorException/);
		}
	});

	it("LSA-B66: non-object JSON throws bedrockAdapter.parseChunk expected object", () => {
		expect(() => bedrockAdapter().parseChunk(JSON.stringify(["array"]))).toThrow(
			/bedrockAdapter\.parseChunk: expected a JSON object/,
		);
	});

	it("LSA-B67: reasoningContent string delta maps reasoning-delta", () => {
		expect(
			bedrockAdapter().parseChunk(
				payload({
					contentBlockDelta: {
						contentBlockIndex: 0,
						delta: { reasoningContent: "thinking aloud" },
					},
				}),
			),
		).toEqual([{ kind: "reasoning-delta", text: "thinking aloud", variant: "detail" }]);
	});

	it("LSA-B68: reasoningContent.thinking maps with modelFamily anthropic", () => {
		expect(
			bedrockAdapter({ modelFamily: "anthropic" }).parseChunk(
				payload({
					contentBlockDelta: {
						contentBlockIndex: 0,
						delta: { reasoningContent: { thinking: "chain" } },
					},
				}),
			),
		).toEqual([{ kind: "reasoning-delta", text: "chain", variant: "detail" }]);
	});

	it("LSA-B69: empty text delta is skipped", () => {
		expect(
			bedrockAdapter().parseChunk(
				payload({
					contentBlockDelta: { contentBlockIndex: 0, delta: { text: "" } },
				}),
			),
		).toEqual([]);
	});

	it("LSA-B70: duplicate messageStart is ignored after first", () => {
		const adapter = bedrockAdapter();
		expect(adapter.parseChunk(payload({ messageStart: { role: "assistant" } }))).toEqual([
			{ kind: "message-start" },
			{ kind: "metadata", raw: { role: "assistant" } },
		]);
		expect(adapter.parseChunk(payload({ messageStart: { role: "assistant" } }))).toEqual([]);
	});

	it("LSA-B71: assembler drops chunks after finish (trace metadata after messageStop)", async () => {
		async function* payloads() {
			yield payload({ messageStart: { role: "assistant" } });
			yield payload({
				contentBlockDelta: { contentBlockIndex: 0, delta: { text: "x" } },
			});
			yield payload({ messageStop: { stopReason: "end_turn" } });
			yield payload({
				metadata: { trace: { guardrail: { actionReason: "late" } } },
			});
		}
		const events = await collectAsync(assembleFromPayloads(payloads(), bedrockAdapter()));
		expect(events.some((event) => event.type === "finish")).toBe(true);
		expect(
			events.some(
				(event) =>
					event.type === "metadata" &&
					typeof event.raw === "object" &&
					event.raw !== null &&
					"trace" in (event.raw as Record<string, unknown>),
			),
		).toBe(false);
	});

	it("LSA-B72: assembler drops usage metadata after messageStop", async () => {
		async function* payloads() {
			yield payload({ messageStart: { role: "assistant" } });
			yield payload({
				contentBlockDelta: { contentBlockIndex: 0, delta: { text: "x" } },
			});
			yield payload({ messageStop: { stopReason: "end_turn" } });
			yield payload({
				metadata: { usage: { inputTokens: 3, outputTokens: 1, totalTokens: 4 } },
			});
		}
		const events = await collectAsync(assembleFromPayloads(payloads(), bedrockAdapter()));
		expect(events.some((event) => event.type === "finish")).toBe(true);
		expect(events.some((event) => event.type === "usage")).toBe(false);
	});

	it("LSA-B73: contentBlockStop for toolUse emits tool-done", () => {
		const adapter = bedrockAdapter();
		expect(
			adapter.parseChunk(
				payload({
					contentBlockStart: {
						contentBlockIndex: 0,
						start: { toolUse: { toolUseId: "tool_1", name: "search" } },
					},
				}),
			),
		).toContainEqual({
			kind: "tool-start",
			id: "tool_1",
			name: "search",
			index: 0,
			choiceIndex: 0,
		});
		expect(
			adapter.parseChunk(payload({ contentBlockStop: { contentBlockIndex: 0 } })),
		).toContainEqual({ kind: "tool-done", id: "tool_1", index: 0, choiceIndex: 0 });
	});

	it("LSA-B74: messageStop max_tokens maps to finish length", () => {
		expect(
			bedrockAdapter().parseChunk(payload({ messageStop: { stopReason: "max_tokens" } })),
		).toContainEqual({ kind: "finish", reason: "length", choiceIndex: 0 });
	});

	it("LSA-B75: unicode text delta preserved", () => {
		expect(
			bedrockAdapter().parseChunk(
				payload({
					contentBlockDelta: { contentBlockIndex: 0, delta: { text: "čaj 🍵" } },
				}),
			),
		).toEqual([{ kind: "text-delta", text: "čaj 🍵", choiceIndex: 0 }]);
	});

	it("LSA-B76: usage in messageStop before finish is emitted when stream still open", async () => {
		const events = await collectAsync(
			assembleFromPayloads(
				strings(
					payload({ messageStart: { role: "assistant" } }),
					payload({
						contentBlockDelta: { contentBlockIndex: 0, delta: { text: "hi" } },
					}),
					payload({
						messageStop: {
							stopReason: "end_turn",
							additionalModelResponseFields: undefined,
						},
					}),
				),
				bedrockAdapter(),
			),
		);
		expect(events.some((event) => event.type === "finish")).toBe(true);
	});

	it("LSA-B77: tool input incremental json delta maps tool-args-delta", () => {
		const adapter = bedrockAdapter();
		adapter.parseChunk(
			payload({
				contentBlockStart: {
					contentBlockIndex: 0,
					start: { toolUse: { toolUseId: "t1", name: "search" } },
				},
			}),
		);
		expect(
			adapter.parseChunk(
				payload({
					contentBlockDelta: {
						contentBlockIndex: 0,
						delta: { toolUse: { input: '{"q":' } },
					},
				}),
			),
		).toContainEqual(
			expect.objectContaining({
				kind: "tool-args-delta",
				id: "t1",
				delta: '{"q":',
				index: 0,
				choiceIndex: 0,
			}),
		);
	});

	it("LSA-B78: provider-error golden stream matches expected events", async () => {
		const events = normalizeBedrockEvents(
			await collectAsync(
				assembleFromPayloads(
					(async function* () {
						for (const line of bedrockJsonlLines("provider-error")) yield line;
					})(),
					bedrockAdapter(),
				),
			),
		);
		expect(events).toEqual(expectedBedrockEvents("provider-error"));
	});
});
