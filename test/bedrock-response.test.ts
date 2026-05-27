import { describe, expect, it } from "vitest";
import { bedrockAdapter } from "../src/adapters/bedrock";
import { assembleResponse } from "../src/core/assemble-response";
import {
	bedrockJSONFixture,
	expectedBedrockEvents,
	normalizeBedrockEvents,
} from "./helpers/bedrock-fixtures";

describe("bedrockAdapter parseResponse", () => {
	it("LSA-B20: response-text.json matches expected events", () => {
		expect(
			normalizeBedrockEvents(
				assembleResponse(bedrockJSONFixture("response-text"), bedrockAdapter()),
			),
		).toEqual(expectedBedrockEvents("response-text"));
	});

	it("LSA-B21: response-tool.json matches expected events", () => {
		expect(
			normalizeBedrockEvents(
				assembleResponse(bedrockJSONFixture("response-tool"), bedrockAdapter()),
			),
		).toEqual(expectedBedrockEvents("response-tool"));
	});

	it("LSA-B22: response-error.json matches expected events", () => {
		expect(
			normalizeBedrockEvents(
				assembleResponse(bedrockJSONFixture("response-error"), bedrockAdapter()),
			),
		).toEqual(expectedBedrockEvents("response-error"));
	});

	it("LSA-B72: non-object parseResponse throws prefixed error", () => {
		expect(() => assembleResponse(null, bedrockAdapter())).toThrow(
			/^llm-stream-assemble: bedrockAdapter\.parseResponse expected/,
		);
	});

	it("LSA-B73: empty object response yields synthetic finish stop", () => {
		expect(normalizeBedrockEvents(assembleResponse({}, bedrockAdapter()))).toEqual([
			{ type: "finish", reason: "stop" },
		]);
	});

	it("LSA-B74: parseResponse throttlingException maps to error finish", () => {
		expect(
			normalizeBedrockEvents(
				assembleResponse({ throttlingException: { message: "Slow down" } }, bedrockAdapter()),
			),
		).toEqual([
			{ type: "error", recoverable: false },
			{ type: "finish", reason: "error" },
		]);
	});

	it("LSA-B75: parseResponse internalServerException maps to error finish", () => {
		expect(
			normalizeBedrockEvents(
				assembleResponse(
					{ internalServerException: { message: "Internal failure" } },
					bedrockAdapter(),
				),
			),
		).toEqual([
			{ type: "error", recoverable: false },
			{ type: "finish", reason: "error" },
		]);
	});

	it("LSA-B76: parseResponse jsonMode maps output text to json events", () => {
		const events = assembleResponse(
			{
				output: { message: { role: "assistant", content: [{ text: '{"a":1}' }] } },
				stopReason: "end_turn",
			},
			bedrockAdapter({ jsonMode: true }),
		);
		expect(events.some((event) => event.type === "json.delta")).toBe(true);
		expect(events.some((event) => event.type === "text.delta")).toBe(false);
	});
});
