import { describe, expect, it } from "vitest";
import { openaiChatAdapter, type OpenAIChatAdapterOptions } from "../src/adapters/openai-chat";
import { assembleResponse } from "../src/core/assemble-response";
import {
	expectedOpenAIEvents,
	normalizeEvents,
	openAIJSONFixture,
} from "./helpers/openai-fixtures";

function assembledResponseFixture(name: string, options?: OpenAIChatAdapterOptions) {
	return normalizeEvents(assembleResponse(openAIJSONFixture(name), openaiChatAdapter(options)));
}

describe("openaiChatAdapter parseResponse", () => {
	it("LSA-O44: non-stream text response matches expected events", () => {
		expect(assembledResponseFixture("response-text")).toEqual(
			expectedOpenAIEvents("response-text"),
		);
	});

	it("LSA-O45: non-stream tool response matches expected events", () => {
		expect(assembledResponseFixture("response-tool")).toEqual(
			expectedOpenAIEvents("response-tool"),
		);
	});

	it("LSA-O46: non-stream legacy function_call response matches expected events", () => {
		expect(assembledResponseFixture("response-legacy-function-call")).toEqual(
			expectedOpenAIEvents("response-legacy-function-call"),
		);
	});

	it("LSA-O47: non-stream refusal response matches expected events", () => {
		expect(assembledResponseFixture("response-refusal")).toEqual(
			expectedOpenAIEvents("response-refusal"),
		);
	});

	it("LSA-O48: non-stream JSON mode response matches expected events", () => {
		expect(assembledResponseFixture("response-json-mode", { jsonMode: true })).toEqual(
			expectedOpenAIEvents("response-json-mode"),
		);
	});

	it("LSA-O49: non-object response throws a prefixed parseResponse error", () => {
		expect(() => assembleResponse(null, openaiChatAdapter())).toThrow(
			/^llm-stream-assemble: openaiChatAdapter\.parseResponse.*expected/,
		);
	});

	it("LSA-O50: response with top-level error maps provider error", () => {
		expect(assembledResponseFixture("response-provider-error")[0]).toEqual({
			type: "error",
			recoverable: false,
		});
	});
});
