import { describe, expect, it } from "vitest";
import { openaiChatAdapter } from "../src/adapters/openai-chat";
import { openaiCompatibleAdapter } from "../src/adapters/openai-compatible";
import { normalizeCompatibleRawChunks } from "./helpers/compatible-fixtures";

const payload = (value: unknown) => JSON.stringify(value);

describe("openaiCompatibleAdapter basic behavior", () => {
	it("LSA-OC01: is exported and returns a StreamAdapter", () => {
		const adapter = openaiCompatibleAdapter();
		expect(typeof adapter.parseChunk).toBe("function");
		expect(typeof adapter.parseResponse).toBe("function");
	});

	it("LSA-OC02: standard OpenAI-shaped text maps like OpenAI Chat", () => {
		const raw = payload({ choices: [{ index: 0, delta: { content: "hi" } }] });
		expect(openaiCompatibleAdapter().parseChunk(raw)).toEqual(openaiChatAdapter().parseChunk(raw));
	});

	it("LSA-OC03: DONE returns empty chunks", () => {
		expect(openaiCompatibleAdapter().parseChunk("[DONE]")).toEqual([]);
	});

	it("LSA-OC04: malformed JSON throws prefixed compatible adapter error", () => {
		expect(() => openaiCompatibleAdapter().parseChunk("{")).toThrow(
			/^llm-stream-assemble: openaiCompatibleAdapter\.parseChunk/,
		);
	});

	it("LSA-OC05: jsonMode maps content to json-delta", () => {
		expect(
			openaiCompatibleAdapter({ jsonMode: true }).parseChunk(
				payload({ choices: [{ delta: { content: '{"x":' } }] }),
			),
		).toEqual([{ kind: "json-delta", delta: '{"x":' }]);
	});

	it("LSA-OC06: generic compatible raw chunks match OpenAI Chat for OpenAI-shaped payload", () => {
		const raw = payload({
			id: "chatcmpl_same",
			model: "gpt-4o-mini",
			choices: [{ index: 0, delta: { content: "same" }, finish_reason: "stop" }],
		});
		expect(normalizeCompatibleRawChunks(openaiCompatibleAdapter().parseChunk(raw))).toEqual(
			normalizeCompatibleRawChunks(openaiChatAdapter().parseChunk(raw)),
		);
	});
});
