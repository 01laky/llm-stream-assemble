import { describe, expect, it } from "vitest";
import { cohereAdapter } from "../src/adapters/cohere";
import { assembleResponse } from "../src/core/assemble-response";
import {
	assembleCohereResponse,
	cohereJSONFixture,
	expectedCohereEvents,
	normalizeCohereEvents,
} from "./helpers/cohere-fixtures";

describe("cohereAdapter parseResponse", () => {
	it("LSA-CO21: response-text.json matches expected events", () => {
		expect(assembleCohereResponse("response-text")).toEqual(expectedCohereEvents("response-text"));
	});

	it("LSA-CO22: response-tool.json matches expected events", () => {
		expect(assembleCohereResponse("response-tool")).toEqual(expectedCohereEvents("response-tool"));
	});

	it("LSA-CO23: response-error.json matches expected events", () => {
		expect(assembleCohereResponse("response-error")).toEqual(
			expectedCohereEvents("response-error"),
		);
	});

	it("LSA-CO24: response-format-json.json matches expected events with jsonMode", () => {
		expect(assembleCohereResponse("response-format-json", { jsonMode: true })).toEqual(
			expectedCohereEvents("response-format-json"),
		);
	});

	it("LSA-CO25: non-object parseResponse throws prefixed error", () => {
		expect(() => assembleResponse(null, cohereAdapter())).toThrow(
			/^llm-stream-assemble: cohereAdapter\.parseResponse expected/,
		);
	});

	it("LSA-CO26: empty object response yields synthetic finish stop", () => {
		expect(normalizeCohereEvents(assembleResponse({}, cohereAdapter()))).toEqual([
			{ type: "finish", reason: "stop", choiceIndex: 0 },
		]);
	});

	it("LSA-CO28: parseResponse provider error body maps to error finish", () => {
		expect(
			normalizeCohereEvents(
				assembleResponse({ type: "error", error: { message: "Invalid request" } }, cohereAdapter()),
			),
		).toEqual([
			{ type: "error", recoverable: false },
			{ type: "finish", reason: "error" },
		]);
	});

	it("LSA-CO29: parseResponse jsonMode maps output text to json events", () => {
		const events = assembleResponse(
			cohereJSONFixture("response-format-json"),
			cohereAdapter({ jsonMode: true }),
		);
		expect(events.some((event) => event.type === "json.delta")).toBe(true);
		expect(events.some((event) => event.type === "text.delta")).toBe(false);
	});

	it("LSA-CO30: parseResponse without message uses top-level finish_reason", () => {
		expect(
			normalizeCohereEvents(
				assembleResponse(
					{
						finish_reason: "MAX_TOKENS",
						usage: { input_tokens: 1, output_tokens: 0 },
					},
					cohereAdapter(),
				),
			),
		).toEqual([
			{ type: "usage", inputTokens: 1, outputTokens: 0 },
			{ type: "finish", reason: "length", choiceIndex: 0 },
		]);
	});

	it("LSA-CO31: parseResponse synthesizes citation-start metadata from message citations", () => {
		const events = normalizeCohereEvents(
			assembleResponse(
				{
					id: "resp-cite",
					message: {
						role: "assistant",
						content: [{ type: "text", text: "See docs." }],
						citations: [{ start: 4, end: 8, text: "docs" }],
					},
					finish_reason: "COMPLETE",
				},
				cohereAdapter(),
			),
		);
		expect(events.some((event) => event.type === "text.delta" || event.type === "text.done")).toBe(
			true,
		);
		expect(events.some((event) => event.type === "metadata")).toBe(true);
		expect(events.some((event) => event.type === "finish" && event.reason === "stop")).toBe(true);
	});

	it("LSA-CO32: parseResponse tool_calls array synthesizes tool stream events", () => {
		const events = normalizeCohereEvents(
			assembleResponse(
				{
					id: "resp-tools",
					message: {
						role: "assistant",
						tool_calls: [
							{
								id: "t1",
								type: "function",
								function: { name: "alpha", arguments: '{"a":1}' },
							},
							{
								id: "t2",
								type: "function",
								function: { name: "beta", arguments: '{"b":2}' },
							},
						],
					},
					finish_reason: "TOOL_CALL",
				},
				cohereAdapter(),
			),
		);
		const starts = events.filter((event) => event.type === "tool_call.start");
		expect(starts.map((event) => event.id)).toEqual(["t1", "t2"]);
		expect(events.some((event) => event.type === "finish" && event.reason === "tool_calls")).toBe(
			true,
		);
	});

	it("LSA-CO33: parseResponse lowercase complete finish_reason maps stop", () => {
		expect(
			normalizeCohereEvents(
				assembleResponse(
					{
						message: { role: "assistant", content: [{ type: "text", text: "ok" }] },
						finish_reason: "complete",
					},
					cohereAdapter(),
				),
			),
		).toContainEqual({ type: "finish", reason: "stop", choiceIndex: 0 });
	});
});
