import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { anthropicAdapter } from "../src/adapters/anthropic";
import { assembleFromPayloads } from "../src/core/assemble-payloads";
import { assembleStream } from "../src/core/assemble-stream";
import { byteStreamFromStrings, collectAsync, strings } from "./helpers/collect-events";
import {
	anthropicTextFixture,
	expectedAnthropicEvents,
	normalizeAnthropicEvents,
} from "./helpers/anthropic-fixtures";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const payload = (value: unknown) => JSON.stringify(value);

describe("anthropicAdapter edge cases and docs", () => {
	it("LSA-A21: message_stop without message_delta emits stop finish", () => {
		expect(anthropicAdapter().parseChunk(payload({ type: "message_stop" }))).toEqual([
			{ kind: "finish", reason: "stop" },
		]);
	});

	it("LSA-A22: redacted_thinking block is ignored", () => {
		expect(
			anthropicAdapter().parseChunk(
				payload({
					type: "content_block_start",
					index: 0,
					content_block: { type: "redacted_thinking", data: "redacted" },
				}),
			),
		).toEqual([]);
	});

	it("LSA-A23: jsonMode maps text block deltas to json events", async () => {
		const events = normalizeAnthropicEvents(
			await collectAsync(
				assembleFromPayloads(
					strings(
						payload({ type: "content_block_start", index: 0, content_block: { type: "text" } }),
						payload({
							type: "content_block_delta",
							index: 0,
							delta: { type: "text_delta", text: '{"ok":true}' },
						}),
						payload({ type: "message_delta", delta: { stop_reason: "end_turn" } }),
					),
					anthropicAdapter({ jsonMode: true }),
				),
			),
		);
		expect(events).toEqual([
			{ type: "json.delta", delta: '{"ok":true}', partial: { ok: true } },
			{ type: "json.done", value: { ok: true } },
			{ type: "finish", reason: "stop" },
		]);
	});

	it("LSA-A24: unknown content block types are ignored without throwing", () => {
		expect(
			anthropicAdapter().parseChunk(
				payload({ type: "content_block_start", index: 0, content_block: { type: "image" } }),
			),
		).toEqual([]);
	});

	it("LSA-A25: fixture provenance README exists and references Anthropic fixtures", () => {
		const readme = readFileSync(join(rootDir, "test/fixtures/anthropic/README.md"), "utf8");
		for (const name of ["text-basic", "tool-use", "thinking", "refusal", "provider-error"]) {
			expect(readme).toContain(name);
		}
	});

	it("LSA-A34: empty or whitespace line yields no chunks", () => {
		expect(anthropicAdapter().parseChunk("")).toEqual([]);
		expect(anthropicAdapter().parseChunk("   ")).toEqual([]);
	});

	it("LSA-A35: [DONE] marker yields no chunks", () => {
		expect(anthropicAdapter().parseChunk("[DONE]")).toEqual([]);
	});

	it("LSA-A36: malformed JSON throws anthropicAdapter.parseChunk scoped prefix", () => {
		expect(() => anthropicAdapter().parseChunk("{")).toThrow(/anthropicAdapter\.parseChunk/);
	});

	it("LSA-A37: non-object JSON throws expected object scoped error", () => {
		expect(() => anthropicAdapter().parseChunk(JSON.stringify(["array"]))).toThrow(
			/anthropicAdapter\.parseChunk: expected a JSON object/,
		);
	});

	it("LSA-A38: error event preserves raw on provider-error via payload helper", () => {
		const chunks = anthropicAdapter().parseChunk(
			payload({ type: "error", error: { type: "api_error", message: "rate limited" } }),
		);
		expect(chunks).toHaveLength(2);
		expect(chunks[0]?.kind).toBe("provider-error");
		if (chunks[0]?.kind === "provider-error") {
			expect(chunks[0].error.message).toMatch(/rate limited/);
			expect((chunks[0].error as Error & { raw?: unknown }).raw).toEqual({
				type: "api_error",
				message: "rate limited",
			});
		}
	});

	it("LSA-A39: ping event is ignored", () => {
		expect(anthropicAdapter().parseChunk(payload({ type: "ping" }))).toEqual([]);
	});

	it("LSA-A40: duplicate message_stop after message_delta finish is ignored", () => {
		const adapter = anthropicAdapter();
		expect(
			adapter.parseChunk(payload({ type: "message_delta", delta: { stop_reason: "end_turn" } })),
		).toContainEqual({ kind: "finish", reason: "stop" });
		expect(adapter.parseChunk(payload({ type: "message_stop" }))).toEqual([]);
	});

	it("LSA-A41: assembler drops chunks after finish (usage after terminal stop)", async () => {
		async function* payloads() {
			yield payload({
				type: "content_block_delta",
				index: 0,
				delta: { type: "text_delta", text: "hi" },
			});
			yield payload({ type: "message_delta", delta: { stop_reason: "end_turn" } });
			yield payload({
				type: "message_delta",
				usage: { input_tokens: 9, output_tokens: 1 },
			});
		}
		const events = await collectAsync(assembleFromPayloads(payloads(), anthropicAdapter()));
		expect(events.some((event) => event.type === "finish")).toBe(true);
		expect(events.some((event) => event.type === "usage")).toBe(false);
	});

	it("LSA-A42: assembler drops post-finish text deltas", async () => {
		async function* payloads() {
			yield payload({
				type: "content_block_delta",
				index: 0,
				delta: { type: "text_delta", text: "hi" },
			});
			yield payload({ type: "message_delta", delta: { stop_reason: "end_turn" } });
			yield payload({
				type: "content_block_delta",
				index: 0,
				delta: { type: "text_delta", text: "late" },
			});
		}
		const events = await collectAsync(assembleFromPayloads(payloads(), anthropicAdapter()));
		expect(events.filter((event) => event.type === "text.delta")).toHaveLength(1);
	});

	it("LSA-A43: thinking block delta maps to reasoning-delta", () => {
		expect(
			anthropicAdapter().parseChunk(
				payload({
					type: "content_block_delta",
					index: 0,
					delta: { type: "thinking_delta", thinking: "plan" },
				}),
			),
		).toEqual([{ kind: "reasoning-delta", text: "plan", variant: "detail" }]);
	});

	it("LSA-A44: input_json_delta maps to tool-args-delta", () => {
		const adapter = anthropicAdapter();
		expect(
			adapter.parseChunk(
				payload({
					type: "content_block_start",
					index: 0,
					content_block: { type: "tool_use", id: "toolu_1", name: "search" },
				}),
			),
		).toContainEqual({ kind: "tool-start", id: "toolu_1", name: "search", index: 0 });
		expect(
			adapter.parseChunk(
				payload({
					type: "content_block_delta",
					index: 0,
					delta: { type: "input_json_delta", partial_json: '{"q":"x"}' },
				}),
			),
		).toContainEqual({
			kind: "tool-args-delta",
			id: "toolu_1",
			delta: '{"q":"x"}',
			index: 0,
		});
	});

	it("LSA-A45: max_tokens stop_reason maps to finish length", () => {
		expect(
			anthropicAdapter().parseChunk(
				payload({ type: "message_delta", delta: { stop_reason: "max_tokens" } }),
			),
		).toContainEqual({ kind: "finish", reason: "length" });
	});

	it("LSA-A46: content_filtered stop_reason maps to finish content_filter", () => {
		expect(
			anthropicAdapter().parseChunk(
				payload({ type: "message_delta", delta: { stop_reason: "content_filtered" } }),
			),
		).toContainEqual({ kind: "finish", reason: "content_filter" });
	});

	it("LSA-A47: guardrail_intervened stop_reason maps to finish content_filter", () => {
		expect(
			anthropicAdapter().parseChunk(
				payload({ type: "message_delta", delta: { stop_reason: "guardrail_intervened" } }),
			),
		).toContainEqual({ kind: "finish", reason: "content_filter" });
	});

	it("LSA-A48: tool_use stop_reason maps to finish tool_calls", () => {
		expect(
			anthropicAdapter().parseChunk(
				payload({ type: "message_delta", delta: { stop_reason: "tool_use" } }),
			),
		).toContainEqual({ kind: "finish", reason: "tool_calls" });
	});

	it("LSA-A49: stop_sequence stop_reason maps to finish stop", () => {
		expect(
			anthropicAdapter().parseChunk(
				payload({ type: "message_delta", delta: { stop_reason: "stop_sequence" } }),
			),
		).toContainEqual({ kind: "finish", reason: "stop" });
	});

	it("LSA-A50: refusal content block start maps refusal-delta", () => {
		expect(
			anthropicAdapter().parseChunk(
				payload({
					type: "content_block_start",
					index: 0,
					content_block: { type: "refusal", refusal: "cannot comply" },
				}),
			),
		).toContainEqual({ kind: "refusal-delta", text: "cannot comply" });
	});

	it("LSA-A51: content_block_stop for tool_use emits tool-done", () => {
		const adapter = anthropicAdapter();
		adapter.parseChunk(
			payload({
				type: "content_block_start",
				index: 0,
				content_block: { type: "tool_use", id: "toolu_9", name: "fetch" },
			}),
		);
		expect(adapter.parseChunk(payload({ type: "content_block_stop", index: 0 }))).toContainEqual({
			kind: "tool-done",
			id: "toolu_9",
			index: 0,
		});
	});

	it("LSA-A52: unicode text_delta preserved in parseChunk", () => {
		expect(
			anthropicAdapter().parseChunk(
				payload({
					type: "content_block_delta",
					index: 0,
					delta: { type: "text_delta", text: "čaj 🍵" },
				}),
			),
		).toEqual([{ kind: "text-delta", text: "čaj 🍵" }]);
	});

	it("LSA-A53: unknown event type throws scoped library error", () => {
		expect(() => anthropicAdapter().parseChunk(payload({ type: "future_event", data: 1 }))).toThrow(
			/anthropicAdapter\.parseChunk unknown event type/,
		);
	});

	it("LSA-A54: refusal golden stream matches expected events", async () => {
		const events = normalizeAnthropicEvents(
			await collectAsync(
				assembleStream(
					byteStreamFromStrings(anthropicTextFixture("refusal", "sse")),
					anthropicAdapter(),
				),
			),
		);
		expect(events).toEqual(expectedAnthropicEvents("refusal"));
	});

	it("LSA-A55: assembler drops post-finish tool input_json_delta", async () => {
		async function* payloads() {
			yield payload({
				type: "content_block_start",
				index: 0,
				content_block: { type: "tool_use", id: "toolu_late", name: "search" },
			});
			yield payload({ type: "message_delta", delta: { stop_reason: "tool_use" } });
			yield payload({
				type: "content_block_delta",
				index: 0,
				delta: { type: "input_json_delta", partial_json: '{"late":true}' },
			});
		}
		const events = await collectAsync(assembleFromPayloads(payloads(), anthropicAdapter()));
		expect(events.filter((event) => event.type === "tool_call.args.delta")).toHaveLength(0);
	});
});
