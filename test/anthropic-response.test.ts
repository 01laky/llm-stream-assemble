import { describe, expect, it } from "vitest";
import { anthropicAdapter } from "../src/adapters/anthropic";
import { assembleResponse } from "../src/core/assemble-response";
import {
	anthropicJSONFixture,
	expectedAnthropicEvents,
	normalizeAnthropicEvents,
} from "./helpers/anthropic-fixtures";

function responseFixture(name: string) {
	return normalizeAnthropicEvents(assembleResponse(anthropicJSONFixture(name), anthropicAdapter()));
}

describe("anthropicAdapter parseResponse", () => {
	it("LSA-A17: response-text.json matches expected events", () => {
		expect(responseFixture("response-text")).toEqual(expectedAnthropicEvents("response-text"));
	});

	it("LSA-A18: response-tool.json matches expected events", () => {
		expect(responseFixture("response-tool")).toEqual(expectedAnthropicEvents("response-tool"));
	});

	it("LSA-A19: non-object response throws prefixed parseResponse error", () => {
		expect(() => assembleResponse(null, anthropicAdapter())).toThrow(
			/^llm-stream-assemble: anthropicAdapter\.parseResponse/,
		);
	});

	it("LSA-A20: top-level error response emits finish error", () => {
		expect(
			normalizeAnthropicEvents(
				assembleResponse({ type: "error", error: { message: "bad" } }, anthropicAdapter()),
			),
		).toEqual([
			{ type: "error", recoverable: false },
			{ type: "finish", reason: "error" },
		]);
	});
});
