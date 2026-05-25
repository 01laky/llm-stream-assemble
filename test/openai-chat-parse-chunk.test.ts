import { describe, expect, it } from "vitest";
import { openaiChatAdapter } from "../src/adapters/openai-chat";
import { normalizeRawChunks } from "./helpers/openai-fixtures";

function chunk(payload: unknown): string {
	return JSON.stringify(payload);
}

describe("openaiChatAdapter parseChunk", () => {
	it("LSA-O01: role-only first chunk emits message-start and metadata only", () => {
		const adapter = openaiChatAdapter();
		expect(
			normalizeRawChunks(
				adapter.parseChunk(
					chunk({
						id: "chatcmpl_role",
						created: 1,
						model: "gpt-4o-mini",
						choices: [{ index: 0, delta: { role: "assistant" }, finish_reason: null }],
					}),
				),
			),
		).toEqual([
			{ kind: "message-start", id: "chatcmpl_role" },
			{ kind: "metadata", model: "gpt-4o-mini", responseId: "chatcmpl_role", created: 1 },
		]);
	});

	it("LSA-O02: maps basic content to text-delta", () => {
		expect(
			openaiChatAdapter().parseChunk(chunk({ choices: [{ index: 0, delta: { content: "hi" } }] })),
		).toEqual([{ kind: "text-delta", text: "hi", choiceIndex: 0 }]);
	});

	it("LSA-O03: skips empty and null content", () => {
		expect(
			openaiChatAdapter().parseChunk(
				chunk({
					choices: [
						{ index: 0, delta: { content: "" } },
						{ index: 1, delta: { content: null } },
					],
				}),
			),
		).toEqual([]);
	});

	it("LSA-O04: preserves unicode content", () => {
		expect(
			openaiChatAdapter().parseChunk(
				chunk({ choices: [{ index: 0, delta: { content: "Ahoj 😀" } }] }),
			),
		).toEqual([{ kind: "text-delta", text: "Ahoj 😀", choiceIndex: 0 }]);
	});

	it("LSA-O05: maps content to json-delta in jsonMode", () => {
		expect(
			openaiChatAdapter({ jsonMode: true }).parseChunk(
				chunk({ choices: [{ index: 0, delta: { content: '{"ok":' } }] }),
			),
		).toEqual([{ kind: "json-delta", delta: '{"ok":' }]);
	});

	it("LSA-O06: returns empty chunks for DONE", () => {
		expect(openaiChatAdapter().parseChunk("[DONE]")).toEqual([]);
	});

	it("LSA-O07: malformed JSON throws a prefixed adapter error", () => {
		expect(() => openaiChatAdapter().parseChunk("{")).toThrow(
			/^llm-stream-assemble: openaiChatAdapter\.parseChunk/,
		);
	});

	it("LSA-O08: provider error maps to provider-error", () => {
		const chunks = openaiChatAdapter().parseChunk(
			chunk({ error: { message: "rate limit", type: "rate_limit_error" } }),
		);
		expect(normalizeRawChunks(chunks)).toEqual([
			{ kind: "provider-error", recoverable: false },
			{ kind: "finish", reason: "error" },
		]);
	});
});
