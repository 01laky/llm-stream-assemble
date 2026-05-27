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

	it("LSA-B79: assembler drops post-finish text contentBlockDelta", async () => {
		async function* payloads() {
			yield payload({ messageStart: { role: "assistant" } });
			yield payload({
				contentBlockDelta: { contentBlockIndex: 0, delta: { text: "ok" } },
			});
			yield payload({ messageStop: { stopReason: "end_turn" } });
			yield payload({
				contentBlockDelta: { contentBlockIndex: 0, delta: { text: "late" } },
			});
		}
		const events = await collectAsync(assembleFromPayloads(payloads(), bedrockAdapter()));
		expect(events.filter((event) => event.type === "text.delta")).toHaveLength(1);
	});

	it("LSA-B80: assembler drops post-finish reasoningContent delta", async () => {
		async function* payloads() {
			yield payload({ messageStart: { role: "assistant" } });
			yield payload({
				contentBlockDelta: { contentBlockIndex: 0, delta: { text: "ok" } },
			});
			yield payload({ messageStop: { stopReason: "end_turn" } });
			yield payload({
				contentBlockDelta: {
					contentBlockIndex: 0,
					delta: { reasoningContent: "late thought" },
				},
			});
		}
		const events = await collectAsync(assembleFromPayloads(payloads(), bedrockAdapter()));
		expect(events.filter((event) => event.type === "reasoning.delta")).toHaveLength(0);
	});

	it("LSA-B81: jsonMode assembler drops post-finish json text delta", async () => {
		async function* payloads() {
			yield payload({ messageStart: { role: "assistant" } });
			yield payload({
				contentBlockDelta: { contentBlockIndex: 0, delta: { text: '{"a":1}' } },
			});
			yield payload({ messageStop: { stopReason: "end_turn" } });
			yield payload({
				contentBlockDelta: { contentBlockIndex: 0, delta: { text: '{"late":true}' } },
			});
		}
		const events = await collectAsync(
			assembleFromPayloads(payloads(), bedrockAdapter({ jsonMode: true })),
		);
		expect(
			events.some((event) => event.type === "json.delta" && event.delta.includes("late")),
		).toBe(false);
	});

	it("LSA-B82: messageStop guardrail_intervened maps to finish content_filter", () => {
		expect(
			bedrockAdapter().parseChunk(payload({ messageStop: { stopReason: "guardrail_intervened" } })),
		).toContainEqual({ kind: "finish", reason: "content_filter", choiceIndex: 0 });
	});

	it("LSA-B83: messageStop tool_use maps to finish tool_calls", () => {
		expect(
			bedrockAdapter().parseChunk(payload({ messageStop: { stopReason: "tool_use" } })),
		).toContainEqual({ kind: "finish", reason: "tool_calls", choiceIndex: 0 });
	});

	it("LSA-B84: duplicate messageStop after finish is dropped by assembler", async () => {
		const events = await collectAsync(
			assembleFromPayloads(
				strings(
					payload({ messageStart: { role: "assistant" } }),
					payload({
						contentBlockDelta: { contentBlockIndex: 0, delta: { text: "x" } },
					}),
					payload({ messageStop: { stopReason: "end_turn" } }),
					payload({ messageStop: { stopReason: "end_turn" } }),
				),
				bedrockAdapter(),
			),
		);
		expect(events.filter((event) => event.type === "finish")).toHaveLength(1);
	});

	it("LSA-B85: guardrail-intervened golden stream matches expected events", async () => {
		const events = normalizeBedrockEvents(
			await collectAsync(
				assembleFromPayloads(
					(async function* () {
						for (const line of bedrockJsonlLines("guardrail-intervened")) yield line;
					})(),
					bedrockAdapter(),
				),
			),
		);
		expect(events).toEqual(expectedBedrockEvents("guardrail-intervened"));
	});

	it("LSA-B86: incomplete golden stream matches expected events", async () => {
		const events = normalizeBedrockEvents(
			await collectAsync(
				assembleFromPayloads(
					(async function* () {
						for (const line of bedrockJsonlLines("incomplete")) yield line;
					})(),
					bedrockAdapter(),
				),
			),
		);
		expect(events).toEqual(expectedBedrockEvents("incomplete"));
	});

	it("LSA-B87: nova modelFamily text-basic golden matches expected events", async () => {
		const events = normalizeBedrockEvents(
			await collectAsync(
				assembleFromPayloads(
					(async function* () {
						for (const line of bedrockJsonlLines("nova-text-basic")) yield line;
					})(),
					bedrockAdapter({ modelFamily: "nova" }),
				),
			),
		);
		expect(events).toEqual(expectedBedrockEvents("nova-text-basic"));
	});

	it("LSA-B88: usage-metadata golden stream emits usage event", async () => {
		const events = normalizeBedrockEvents(
			await collectAsync(
				assembleFromPayloads(
					(async function* () {
						for (const line of bedrockJsonlLines("usage-metadata")) yield line;
					})(),
					bedrockAdapter(),
				),
			),
		);
		expect(events).toEqual(expectedBedrockEvents("usage-metadata"));
		expect(events.some((event) => (event as { type?: string }).type === "usage")).toBe(true);
	});

	it("LSA-B89: text-unicode golden stream preserves UTF-8 text", async () => {
		const events = normalizeBedrockEvents(
			await collectAsync(
				assembleFromPayloads(
					(async function* () {
						for (const line of bedrockJsonlLines("text-unicode")) yield line;
					})(),
					bedrockAdapter(),
				),
			),
		);
		expect(events).toEqual(expectedBedrockEvents("text-unicode"));
	});

	it("LSA-B90: tool-partial-input golden stream matches expected events", async () => {
		const events = normalizeBedrockEvents(
			await collectAsync(
				assembleFromPayloads(
					(async function* () {
						for (const line of bedrockJsonlLines("tool-partial-input")) yield line;
					})(),
					bedrockAdapter(),
				),
			),
		);
		expect(events).toEqual(expectedBedrockEvents("tool-partial-input"));
	});

	it("LSA-B91: contentBlockStart preserves block index on tool-start", () => {
		expect(
			bedrockAdapter().parseChunk(
				payload({
					contentBlockStart: {
						contentBlockIndex: 2,
						start: { toolUse: { toolUseId: "t2", name: "search" } },
					},
				}),
			),
		).toContainEqual(
			expect.objectContaining({ kind: "tool-start", id: "t2", name: "search", index: 2 }),
		);
	});

	it("LSA-B92: metadata usage before messageStop is emitted during open stream", async () => {
		const events = await collectAsync(
			assembleFromPayloads(
				strings(
					payload({ messageStart: { role: "assistant" } }),
					payload({
						contentBlockDelta: { contentBlockIndex: 0, delta: { text: "hi" } },
					}),
					payload({
						metadata: { usage: { inputTokens: 4, outputTokens: 2, totalTokens: 6 } },
					}),
					payload({ messageStop: { stopReason: "end_turn" } }),
				),
				bedrockAdapter(),
			),
		);
		expect(events.some((event) => event.type === "usage")).toBe(true);
		expect(events.some((event) => event.type === "finish")).toBe(true);
	});
});
