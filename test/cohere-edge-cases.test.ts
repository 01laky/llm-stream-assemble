import { describe, expect, it } from "vitest";
import { cohereAdapter } from "../src/adapters/cohere";
import { assembleFromPayloads } from "../src/core/assemble-payloads";
import { assembleStream } from "../src/core/assemble-stream";
import { byteStreamFromStrings, collectAsync } from "./helpers/collect-events";
import {
	assembleCohereJsonl,
	cohereJsonlLines,
	expectedCohereEvents,
	normalizeCohereEvents,
} from "./helpers/cohere-fixtures";

const payload = (value: unknown) => JSON.stringify(value);

describe("cohereAdapter edge cases", () => {
	it("LSA-CO12: empty or whitespace line yields no chunks", () => {
		expect(cohereAdapter().parseChunk("")).toEqual([]);
		expect(cohereAdapter().parseChunk("   ")).toEqual([]);
	});

	it("LSA-CO13: malformed JSON throws cohereAdapter.parseChunk prefix", () => {
		expect(() => cohereAdapter().parseChunk("{")).toThrow(/cohereAdapter\.parseChunk/);
	});

	it("LSA-CO14: unknown event type yields benign metadata.raw", () => {
		expect(cohereAdapter().parseChunk(payload({ type: "future-event", foo: "bar" }))).toEqual([
			{ kind: "metadata", raw: { type: "future-event", foo: "bar" } },
		]);
	});

	it("LSA-CO60: [DONE] marker yields no chunks", () => {
		expect(cohereAdapter().parseChunk("[DONE]")).toEqual([]);
	});

	it("LSA-CO66: non-object JSON throws cohereAdapter.parseChunk expected object", () => {
		expect(() => cohereAdapter().parseChunk(JSON.stringify(["array"]))).toThrow(
			/cohereAdapter\.parseChunk: expected a JSON object/,
		);
	});

	it("LSA-CO67: empty content-delta text is skipped", () => {
		expect(
			cohereAdapter().parseChunk(
				payload({
					type: "content-delta",
					index: 0,
					delta: { message: { content: { text: "" } } },
				}),
			),
		).toEqual([]);
	});

	it("LSA-CO68: duplicate message-start is ignored after first", () => {
		const adapter = cohereAdapter();
		expect(
			adapter.parseChunk(
				payload({
					type: "message-start",
					id: "msg_1",
					delta: { message: { role: "assistant" } },
				}),
			),
		).toEqual([
			{ kind: "message-start" },
			{ kind: "metadata", responseId: "msg_1", raw: { id: "msg_1", role: "assistant" } },
		]);
		expect(
			adapter.parseChunk(
				payload({
					type: "message-start",
					id: "msg_2",
					delta: { message: { role: "assistant" } },
				}),
			),
		).toEqual([]);
	});

	it("LSA-CO69: provider error fixture maps to error event via assembler", async () => {
		async function* payloads() {
			for (const line of cohereJsonlLines("provider-error")) yield line;
		}
		expect(
			normalizeCohereEvents(await collectAsync(assembleFromPayloads(payloads(), cohereAdapter()))),
		).toEqual(expectedCohereEvents("provider-error"));
	});

	it("LSA-CO70: jsonMode maps text deltas to json events", async () => {
		const events = await collectAsync(
			assembleFromPayloads(
				(async function* () {
					for (const line of cohereJsonlLines("json-mode")) yield line;
				})(),
				cohereAdapter({ jsonMode: true }),
			),
		);
		expect(events.some((event) => event.type === "json.delta")).toBe(true);
		expect(events.some((event) => event.type === "text.delta")).toBe(false);
	});

	it("LSA-CO71: parallel tools keep distinct ids through assembly", async () => {
		async function* payloads() {
			for (const line of cohereJsonlLines("tool-parallel")) yield line;
		}
		const events = await collectAsync(assembleFromPayloads(payloads(), cohereAdapter()));
		const starts = events.filter((event) => event.type === "tool_call.start");
		expect(starts.map((event) => event.id)).toEqual(["tool_a", "tool_b"]);
	});

	it("LSA-CO72: stream error object emits provider error chunks", () => {
		const chunks = cohereAdapter().parseChunk(
			payload({ type: "error", error: { message: "Server error" } }),
		);
		expect(chunks).toHaveLength(2);
		expect(chunks[0]?.kind).toBe("provider-error");
		expect(chunks[1]).toEqual({ kind: "finish", reason: "error" });
	});

	it("LSA-CO73: nested error field emits provider error chunks", () => {
		const chunks = cohereAdapter().parseChunk(
			payload({ error: { message: "Bad request", code: "invalid" } }),
		);
		expect(chunks[0]?.kind).toBe("provider-error");
		if (chunks[0]?.kind === "provider-error") {
			expect(chunks[0].error.message).toMatch(/cohereAdapter\.parseChunk/);
		}
	});

	it("LSA-CO74: empty tool-plan-delta is skipped", () => {
		expect(
			cohereAdapter().parseChunk(
				payload({ type: "tool-plan-delta", delta: { message: { tool_plan: "" } } }),
			),
		).toEqual([]);
	});

	it("LSA-CO75: citation-end emits no chunks", () => {
		expect(cohereAdapter().parseChunk(payload({ type: "citation-end", index: 0 }))).toEqual([]);
	});

	it("LSA-CO76: assembler drops chunks after finish", async () => {
		async function* payloads() {
			yield payload({
				type: "message-start",
				id: "msg_late",
				delta: { message: { role: "assistant" } },
			});
			yield payload({
				type: "content-delta",
				index: 0,
				delta: { message: { content: { text: "x" } } },
			});
			yield payload({
				type: "message-end",
				delta: { finish_reason: "COMPLETE" },
			});
			yield payload({ type: "citation-start", index: 0, delta: { message: { citations: {} } } });
		}
		const events = await collectAsync(assembleFromPayloads(payloads(), cohereAdapter()));
		expect(events.some((event) => event.type === "finish")).toBe(true);
		expect(events.filter((event) => event.type === "metadata").length).toBeLessThanOrEqual(2);
	});

	it("LSA-CO77: tool-late-id.jsonl matches expected events", async () => {
		await expect(assembleCohereJsonl("tool-late-id")).resolves.toEqual(
			expectedCohereEvents("tool-late-id"),
		);
	});

	it("LSA-CO78: late id reconciles placeholder cohere:tool index on delta", () => {
		const adapter = cohereAdapter();
		adapter.parseChunk(
			payload({
				type: "tool-call-start",
				index: 0,
				delta: {
					message: {
						tool_calls: {
							type: "function",
							function: { name: "search", arguments: "" },
						},
					},
				},
			}),
		);
		expect(
			adapter.parseChunk(
				payload({
					type: "tool-call-delta",
					index: 0,
					delta: {
						message: {
							tool_calls: {
								id: "real_id_1",
								function: { arguments: "{}" },
							},
						},
					},
				}),
			),
		).toEqual([
			{
				kind: "tool-args-delta",
				id: "real_id_1",
				delta: "{}",
				index: 0,
				choiceIndex: 0,
			},
		]);
	});

	it("LSA-CO79: response-format-json.jsonl streams json.delta events with jsonMode", async () => {
		const events = await assembleCohereJsonl("response-format-json", { jsonMode: true });
		expect(events.some((event) => event.type === "json.delta")).toBe(true);
		expect(events.some((event) => event.type === "text.delta")).toBe(false);
		expect(events.some((event) => event.type === "json.done")).toBe(true);
		expect(events.some((event) => event.type === "finish" && event.reason === "stop")).toBe(true);
	});

	it("LSA-CO80: jsonMode structured output via assembleStream", async () => {
		const events = normalizeCohereEvents(
			await collectAsync(
				assembleStream(
					byteStreamFromStrings(
						cohereJsonlLines("response-format-json")
							.map((line) => `data: ${line}\n\n`)
							.join(""),
					),
					cohereAdapter({ jsonMode: true }),
				),
			),
		);
		expect(events.some((event) => event.type === "json.delta")).toBe(true);
		expect(events.some((event) => event.type === "json.done")).toBe(true);
	});

	it("LSA-CO82: text-empty.jsonl matches expected events", async () => {
		await expect(assembleCohereJsonl("text-empty")).resolves.toEqual(
			expectedCohereEvents("text-empty"),
		);
	});

	it("LSA-CO83: citations-interleaved.jsonl matches expected events", async () => {
		await expect(assembleCohereJsonl("citations-interleaved")).resolves.toEqual(
			expectedCohereEvents("citations-interleaved"),
		);
	});

	it("LSA-CO84: lowercase finish_reason complete maps finish stop", () => {
		expect(
			cohereAdapter().parseChunk(
				payload({ type: "message-end", delta: { finish_reason: "complete" } }),
			),
		).toContainEqual({ kind: "finish", reason: "stop", choiceIndex: 0 });
	});

	it("LSA-CO85: finish_reason containing FILTER maps content_filter", () => {
		expect(
			cohereAdapter().parseChunk(
				payload({ type: "message-end", delta: { finish_reason: "CONTENT_FILTER" } }),
			),
		).toContainEqual({ kind: "finish", reason: "content_filter", choiceIndex: 0 });
	});

	it("LSA-CO86: unicode content-delta preserves UTF-8 text", () => {
		expect(
			cohereAdapter().parseChunk(
				payload({
					type: "content-delta",
					index: 0,
					delta: { message: { content: { text: "Ahoj 🌍 — 日本語" } } },
				}),
			),
		).toEqual([{ kind: "text-delta", text: "Ahoj 🌍 — 日本語", choiceIndex: 0 }]);
	});

	it("LSA-CO87: message-end with empty usage object yields no usage chunk", () => {
		expect(
			cohereAdapter().parseChunk(
				payload({
					type: "message-end",
					delta: { finish_reason: "COMPLETE", usage: { billed_units: {} } },
				}),
			),
		).toEqual([
			{ kind: "metadata", raw: { finish_reason: "COMPLETE" } },
			{ kind: "finish", reason: "stop", choiceIndex: 0 },
		]);
	});

	it("LSA-CO88: assembler drops post-finish citation metadata", async () => {
		async function* payloads() {
			yield payload({
				type: "message-start",
				id: "msg_late",
				delta: { message: { role: "assistant" } },
			});
			yield payload({
				type: "content-delta",
				index: 0,
				delta: { message: { content: { text: "x" } } },
			});
			yield payload({
				type: "message-end",
				delta: { finish_reason: "COMPLETE" },
			});
			yield payload({
				type: "citation-start",
				index: 0,
				delta: {
					message: {
						citations: { text: "late cite", start: 0, end: 4 },
					},
				},
			});
		}
		const events = await collectAsync(assembleFromPayloads(payloads(), cohereAdapter()));
		expect(events.some((event) => event.type === "finish")).toBe(true);
		expect(
			events.some(
				(event) =>
					event.type === "metadata" &&
					typeof event.raw === "object" &&
					event.raw !== null &&
					"citation" in (event.raw as Record<string, unknown>),
			),
		).toBe(false);
	});

	it("LSA-CO89: assembler drops post-finish content-delta text", async () => {
		async function* payloads() {
			yield payload({ type: "message-start", delta: { message: { role: "assistant" } } });
			yield payload({
				type: "content-delta",
				index: 0,
				delta: { message: { content: { text: "before" } } },
			});
			yield payload({
				type: "message-end",
				delta: { finish_reason: "COMPLETE" },
			});
			yield payload({
				type: "content-delta",
				index: 0,
				delta: { message: { content: { text: "late" } } },
			});
		}
		const events = await collectAsync(assembleFromPayloads(payloads(), cohereAdapter()));
		const textDeltas = events.filter((event) => event.type === "text.delta");
		expect(
			textDeltas.every((event) => event.type !== "text.delta" || !event.text.includes("late")),
		).toBe(true);
	});

	it("LSA-CO90: type error with top-level message field emits provider error", () => {
		const chunks = cohereAdapter().parseChunk(
			payload({ type: "error", message: "Internal generation failure", id: "err-1" }),
		);
		expect(chunks).toHaveLength(2);
		expect(chunks[0]?.kind).toBe("provider-error");
		if (chunks[0]?.kind === "provider-error") {
			expect(chunks[0].error.message).toMatch(/Internal generation failure/);
		}
		expect(chunks[1]).toEqual({ kind: "finish", reason: "error" });
	});

	it("LSA-CO91: non-zero content index forwards choiceIndex on text-delta", () => {
		expect(
			cohereAdapter().parseChunk(
				payload({
					type: "content-delta",
					index: 2,
					delta: { message: { content: { text: "branch" } } },
				}),
			),
		).toEqual([{ kind: "text-delta", text: "branch", choiceIndex: 2 }]);
	});

	it("LSA-CO92: tool-no-plan stream emits tool_call without reasoning.delta", async () => {
		const events = await collectAsync(
			assembleFromPayloads(
				(async function* () {
					for (const line of cohereJsonlLines("tool-no-plan")) yield line;
				})(),
				cohereAdapter(),
			),
		);
		expect(events.some((event) => event.type === "tool_call.start")).toBe(true);
		expect(events.some((event) => event.type === "reasoning.delta")).toBe(false);
	});

	it("LSA-CO93: incomplete stream yields finish incomplete", async () => {
		const events = await collectAsync(
			assembleFromPayloads(
				(async function* () {
					for (const line of cohereJsonlLines("incomplete")) yield line;
				})(),
				cohereAdapter(),
			),
		);
		expect(events.some((event) => event.type === "finish" && event.reason === "incomplete")).toBe(
			true,
		);
	});

	it("LSA-CO94: message-start without id emits message-start only when no role metadata", () => {
		expect(
			cohereAdapter().parseChunk(payload({ type: "message-start", delta: { message: {} } })),
		).toEqual([{ kind: "message-start" }]);
	});

	it("LSA-CO95: tool-plan-delta interleaved with tool-call-start preserves order through assembly", async () => {
		const events = await collectAsync(
			assembleFromPayloads(
				(async function* () {
					for (const line of cohereJsonlLines("tool-plan")) yield line;
				})(),
				cohereAdapter(),
			),
		);
		const reasoningIndex = events.findIndex((event) => event.type === "reasoning.delta");
		const toolStartIndex = events.findIndex((event) => event.type === "tool_call.start");
		expect(reasoningIndex).toBeGreaterThanOrEqual(0);
		expect(toolStartIndex).toBeGreaterThan(reasoningIndex);
	});

	it("LSA-CO96: assembler drops post-finish usage on trailing message-end", async () => {
		async function* payloads() {
			yield payload({ type: "message-start", delta: { message: { role: "assistant" } } });
			yield payload({
				type: "content-delta",
				index: 0,
				delta: { message: { content: { text: "x" } } },
			});
			yield payload({
				type: "message-end",
				delta: {
					finish_reason: "COMPLETE",
					usage: { billed_units: { input_tokens: 1, output_tokens: 1 } },
				},
			});
			yield payload({
				type: "message-end",
				delta: {
					usage: { billed_units: { input_tokens: 99, output_tokens: 99 } },
				},
			});
		}
		const events = await collectAsync(assembleFromPayloads(payloads(), cohereAdapter()));
		expect(events.some((event) => event.type === "finish")).toBe(true);
		expect(events.filter((event) => event.type === "usage")).toHaveLength(1);
		expect(events.find((event) => event.type === "usage")?.inputTokens).toBe(1);
	});

	it("LSA-CO97: duplicate tool-call-start with same id does not duplicate tool-start", () => {
		const adapter = cohereAdapter();
		const start = payload({
			type: "tool-call-start",
			index: 0,
			delta: {
				message: {
					tool_calls: {
						id: "dup_tool",
						type: "function",
						function: { name: "fn", arguments: "" },
					},
				},
			},
		});
		expect(adapter.parseChunk(start)).toEqual([
			{ kind: "tool-start", id: "dup_tool", name: "fn", index: 0, choiceIndex: 0 },
		]);
		expect(adapter.parseChunk(start)).toEqual([]);
	});

	it("LSA-CO98: citations-stream golden preserves citation metadata before finish", async () => {
		const events = await collectAsync(
			assembleFromPayloads(
				(async function* () {
					for (const line of cohereJsonlLines("citations-stream")) yield line;
				})(),
				cohereAdapter(),
			),
		);
		expect(
			events.some(
				(event) =>
					event.type === "metadata" &&
					typeof event.raw === "object" &&
					event.raw !== null &&
					"citation" in (event.raw as Record<string, unknown>),
			),
		).toBe(true);
		expect(events.some((event) => event.type === "finish" && event.reason === "stop")).toBe(true);
	});
});
