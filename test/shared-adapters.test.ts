import { describe, expect, it } from "vitest";
import { mapAnthropicLikeStopReason } from "../src/adapters/common/stop-reasons";
import { incrementalJsonStringDelta } from "../src/adapters/common/incremental-json";
import { parseAdapterObjectPayload } from "../src/adapters/common/parse-payload";
import { buildUsageChunk } from "../src/adapters/common/usage";
import { textOrJsonDelta } from "../src/adapters/common/text-delta";
import { anthropicBlockStartChunks } from "../src/adapters/common/anthropic-blocks";

describe("shared adapter utilities", () => {
	it("LSA-SH01: incrementalJsonStringDelta emits suffix on prefix extension", () => {
		const state = { lastArgsJson: '{"a":' };
		expect(incrementalJsonStringDelta(state, '{"a":1}')).toBe("1}");
		expect(state.lastArgsJson).toBe('{"a":1}');
	});

	it("LSA-SH02: incrementalJsonStringDelta replaces when prefix diverges", () => {
		const state = { lastArgsJson: '{"a":1}' };
		expect(incrementalJsonStringDelta(state, '{"b":2}')).toBe('{"b":2}');
	});

	it("LSA-SH03: incrementalJsonStringDelta returns undefined when unchanged", () => {
		const state = { lastArgsJson: '{"ok":true}' };
		expect(incrementalJsonStringDelta(state, '{"ok":true}')).toBeUndefined();
	});

	it("LSA-SH04: mapAnthropicLikeStopReason covers bedrock and anthropic strings", () => {
		expect(mapAnthropicLikeStopReason("end_turn")).toBe("stop");
		expect(mapAnthropicLikeStopReason("tool_use")).toBe("tool_calls");
		expect(mapAnthropicLikeStopReason("max_tokens")).toBe("length");
		expect(mapAnthropicLikeStopReason("guardrail_intervened")).toBe("content_filter");
		expect(mapAnthropicLikeStopReason("refusal")).toBe("content_filter");
		expect(mapAnthropicLikeStopReason("unknown")).toBe("stop");
	});

	it("LSA-SH05: parseAdapterObjectPayload trims and skips [DONE]", () => {
		expect(parseAdapterObjectPayload("  ", "scope")).toBeNull();
		expect(parseAdapterObjectPayload("[DONE]", "scope")).toBeNull();
		expect(parseAdapterObjectPayload('  {"a":1}  ', "scope")).toEqual({ a: 1 });
	});

	it("LSA-SH06: parseAdapterObjectPayload throws scoped error for non-object JSON", () => {
		expect(() => parseAdapterObjectPayload('["x"]', "demo.parseChunk")).toThrow(
			/demo\.parseChunk: expected a JSON object/,
		);
	});

	it("LSA-SH07: buildUsageChunk resolves token field aliases", () => {
		expect(
			buildUsageChunk({
				input_tokens: 1,
				output_tokens: 2,
				thoughtsTokenCount: 3,
			}),
		).toEqual({
			kind: "usage",
			inputTokens: 1,
			outputTokens: 2,
			reasoningTokens: 3,
			raw: { input_tokens: 1, output_tokens: 2, thoughtsTokenCount: 3 },
		});
	});

	it("LSA-SH08: textOrJsonDelta routes jsonMode to json-delta", () => {
		expect(textOrJsonDelta("{}", { jsonMode: true })).toEqual({ kind: "json-delta", delta: "{}" });
		expect(textOrJsonDelta("hi", { choiceIndex: 2 })).toEqual({
			kind: "text-delta",
			text: "hi",
			choiceIndex: 2,
		});
		expect(textOrJsonDelta("", {})).toBeUndefined();
	});

	it("LSA-SH09: anthropicBlockStartChunks stream-start omits tool-done", () => {
		expect(
			anthropicBlockStartChunks({ type: "tool_use", id: "t1", name: "fn", input: { x: 1 } }, 0, {
				mode: "stream-start",
			}),
		).toEqual([
			{ kind: "tool-start", name: "fn", index: 0, id: "t1" },
			{ kind: "tool-args-delta", delta: '{"x":1}', index: 0, id: "t1" },
		]);
	});

	it("LSA-SH10: anthropicBlockStartChunks response includes tool-done", () => {
		expect(
			anthropicBlockStartChunks({ type: "tool_use", id: "t1", name: "fn", input: {} }, 0, {
				mode: "response",
			}),
		).toContainEqual({ kind: "tool-done", id: "t1", index: 0 });
	});
});
