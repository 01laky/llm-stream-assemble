import { describe, expect, it } from "vitest";
import { geminiAdapter } from "../src/adapters/gemini";
import { assembleResponse } from "../src/core/assemble-response";
import {
	expectedGeminiEvents,
	geminiJSONFixture,
	normalizeGeminiEvents,
} from "./helpers/gemini-fixtures";

function responseFixture(name: string, jsonMode = false) {
	return normalizeGeminiEvents(assembleResponse(geminiJSONFixture(name), geminiAdapter({ jsonMode })));
}

describe("geminiAdapter parseResponse", () => {
	it("LSA-G53: response-text.json matches expected events", () => {
		expect(responseFixture("response-text")).toEqual(expectedGeminiEvents("response-text"));
	});

	it("LSA-G54: response-tool.json matches expected events", () => {
		expect(responseFixture("response-tool")).toEqual(expectedGeminiEvents("response-tool"));
	});

	it("LSA-G55: response-error.json matches expected events", () => {
		expect(responseFixture("response-error")).toEqual(expectedGeminiEvents("response-error"));
	});

	it("LSA-G56: response-blocked.json matches expected events", () => {
		expect(responseFixture("response-blocked")).toEqual(expectedGeminiEvents("response-blocked"));
	});

	it("LSA-G57: non-object response throws prefixed parseResponse error", () => {
		expect(() => assembleResponse(null, geminiAdapter())).toThrow(
			/^llm-stream-assemble: geminiAdapter\.parseResponse expected/,
		);
	});

	it("LSA-G58: empty object response yields synthetic finish stop", () => {
		expect(normalizeGeminiEvents(assembleResponse({}, geminiAdapter()))).toEqual([
			{ type: "finish", reason: "stop" },
		]);
	});
});
