import { describe, expect, it } from "vitest";
import { openaiChatAdapter } from "../src/adapters/openai-chat";
import { assembleResponse } from "../src/core/assemble-response";
import { assembleStream } from "../src/core/assemble-stream";
import { byteStreamFromStrings, collectAsync } from "./helpers/collect-events";
import { normalizeEvents, openAIJSONFixture } from "./helpers/openai-fixtures";

describe("openaiChatAdapter provider error terminal behavior", () => {
	it("LSA-O51: streaming provider error emits error followed by finish error", async () => {
		const events = normalizeEvents(
			await collectAsync(
				assembleStream(
					byteStreamFromStrings(
						'data: {"error":{"message":"rate limit","type":"rate_limit_error"}}\n\n',
					),
					openaiChatAdapter(),
				),
			),
		);
		expect(events).toEqual([
			{ type: "error", recoverable: false },
			{ type: "finish", reason: "error" },
		]);
	});

	it("LSA-O52: non-stream provider error emits error followed by finish error", () => {
		expect(
			normalizeEvents(
				assembleResponse(openAIJSONFixture("response-provider-error"), openaiChatAdapter()),
			),
		).toEqual([
			{ type: "error", recoverable: false },
			{ type: "finish", reason: "error" },
		]);
	});

	it("LSA-O53: documents Phase 1 single-terminal behavior for multi-choice finishes", async () => {
		const events = normalizeEvents(
			await collectAsync(
				assembleStream(
					byteStreamFromStrings(
						'data: {"choices":[{"index":0,"delta":{"content":"A"},"finish_reason":"stop"},{"index":1,"delta":{"content":"B"},"finish_reason":"length"}]}\n\n',
					),
					openaiChatAdapter(),
				),
			),
		);
		expect(events).toEqual([
			{ type: "text.delta", text: "A" },
			{ type: "text.done", text: "A" },
			{ type: "finish", reason: "stop" },
		]);
	});
});
