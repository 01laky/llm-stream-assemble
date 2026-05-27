import { describe, expect, it } from "vitest";
import { openaiResponsesAdapter } from "../src/adapters/openai-responses";
import { assembleResponse } from "../src/core/assemble-response";
import {
	expectedResponsesEvents,
	normalizeResponsesEvents,
	responsesJSONFixture,
} from "./helpers/responses-fixtures";

function responseFixture(name: string, options = {}) {
	return normalizeResponsesEvents(
		assembleResponse(responsesJSONFixture(name), openaiResponsesAdapter(options)),
	);
}

describe("openaiResponsesAdapter parseResponse", () => {
	it("LSA-R32: non-stream text response matches expected events", () => {
		expect(responseFixture("response-text")).toEqual(expectedResponsesEvents("response-text"));
	});

	it("LSA-R33: non-stream function call response matches expected events", () => {
		expect(responseFixture("response-function-call")).toEqual(
			expectedResponsesEvents("response-function-call"),
		);
	});

	it("LSA-R34: non-stream failed response emits error finish", () => {
		expect(responseFixture("response-failed")).toEqual(expectedResponsesEvents("response-failed"));
	});

	it("LSA-R35: invalid response body throws prefixed error", () => {
		expect(() => assembleResponse(null, openaiResponsesAdapter())).toThrow(
			/^llm-stream-assemble: openaiResponsesAdapter\.parseResponse/,
		);
	});

	it("LSA-R36: missing status complete-looking response finishes stop", () => {
		expect(
			normalizeResponsesEvents(
				assembleResponse(
					{ output: [{ type: "message", content: [{ type: "output_text", text: "ok" }] }] },
					openaiResponsesAdapter(),
				),
			).at(-1),
		).toEqual({ type: "finish", reason: "stop" });
	});

	it("LSA-R36b: message output content array supports output_text and refusal items", () => {
		const events = normalizeResponsesEvents(
			assembleResponse(
				{
					output: [
						{
							type: "message",
							content: [
								{ type: "output_text", text: "ok" },
								{ type: "refusal", refusal: "no" },
							],
						},
					],
				},
				openaiResponsesAdapter(),
			),
		);
		expect(events).toContainEqual({ type: "text.done", text: "ok" });
		expect(events).toContainEqual({ type: "refusal.done", text: "no" });
	});

	it("LSA-R36c: non-stream JSON mode response maps output text to json events", () => {
		const events = normalizeResponsesEvents(
			assembleResponse(
				{ output: [{ type: "message", content: [{ type: "output_text", text: '{"ok":true}' }] }] },
				openaiResponsesAdapter({ jsonMode: true }),
			),
		);
		expect(events).toContainEqual({ type: "json.done", value: { ok: true } });
	});

	it("LSA-R36d: non-stream reasoning summary maps to reasoning summary events", () => {
		const events = normalizeResponsesEvents(
			assembleResponse(
				{ output: [{ type: "message", summary: "reason" }] },
				openaiResponsesAdapter(),
			),
		);
		expect(events).toContainEqual({ type: "reasoning.done", text: "reason", variant: "summary" });
	});

	it("LSA-R91: logprobs-response.json matches expected events", () => {
		expect(responseFixture("logprobs-response")).toEqual(
			expectedResponsesEvents("logprobs-response"),
		);
	});

	it("LSA-R92: logprobs-refusal-response.json matches expected events", () => {
		expect(responseFixture("logprobs-refusal-response")).toEqual(
			expectedResponsesEvents("logprobs-refusal-response"),
		);
	});

	it("LSA-R93: logprobs-response emits logprob before text.done", () => {
		const events = responseFixture("logprobs-response");
		const logprobIndex = events.findIndex((event) => event.type === "logprob");
		const textIndex = events.findIndex((event) => event.type === "text.done");
		expect(logprobIndex).toBeGreaterThanOrEqual(0);
		expect(textIndex).toBeGreaterThan(logprobIndex);
	});
});
