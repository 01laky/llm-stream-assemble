import { describe, expect, it } from "vitest";
import { openaiCompatibleAdapter } from "../src/adapters/openai-compatible";
import { assembleResponse } from "../src/core/assemble-response";
import {
	compatibleJSONFixture,
	expectedCompatibleEvents,
	normalizeCompatibleEvents,
} from "./helpers/compatible-fixtures";

describe("openaiCompatibleAdapter non-streaming responses", () => {
	it("LSA-OC26: non-stream generic response assembles text", () => {
		expect(
			normalizeCompatibleEvents(
				assembleResponse(compatibleJSONFixture("response-generic"), openaiCompatibleAdapter()),
			),
		).toEqual(expectedCompatibleEvents("response-generic"));
	});

	it("LSA-OC27: non-stream response with missing metadata is tolerated", () => {
		expect(
			normalizeCompatibleEvents(
				assembleResponse(
					{ choices: [{ message: { content: "no metadata" }, finish_reason: "stop" }] },
					openaiCompatibleAdapter(),
				),
			),
		).toEqual([
			{ type: "text.delta", text: "no metadata" },
			{ type: "text.done", text: "no metadata" },
			{ type: "finish", reason: "stop" },
		]);
	});

	it("LSA-OC28: non-stream response with loose provider error emits finish error", () => {
		expect(
			normalizeCompatibleEvents(
				assembleResponse(compatibleJSONFixture("response-loose-error"), openaiCompatibleAdapter()),
			),
		).toEqual(expectedCompatibleEvents("response-loose-error"));
	});

	it("LSA-OC29: non-stream response with usage aliases maps usage", () => {
		expect(
			normalizeCompatibleEvents(
				assembleResponse(
					{ choices: [], usage: { input_tokens: 1, output_tokens: 2 } },
					openaiCompatibleAdapter(),
				),
			),
		).toEqual([
			{ type: "usage", inputTokens: 1, outputTokens: 2 },
			{ type: "finish", reason: "stop" },
		]);
	});

	it("LSA-OC30: non-object response throws prefixed compatible parseResponse error", () => {
		expect(() => assembleResponse(null, openaiCompatibleAdapter())).toThrow(
			/^llm-stream-assemble: openaiCompatibleAdapter\.parseResponse/,
		);
	});
});
