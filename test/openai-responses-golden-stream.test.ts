import { describe, expect, it } from "vitest";
import {
	openaiResponsesAdapter,
	type OpenAIResponsesAdapterOptions,
} from "../src/adapters/openai-responses";
import { assembleStream } from "../src/core/assemble-stream";
import { byteStreamFromStrings, collectAsync } from "./helpers/collect-events";
import {
	expectedResponsesEvents,
	normalizeResponsesEvents,
	responsesTextFixture,
} from "./helpers/responses-fixtures";

async function streamFixture(name: string, options?: OpenAIResponsesAdapterOptions) {
	return normalizeResponsesEvents(
		await collectAsync(
			assembleStream(
				byteStreamFromStrings(responsesTextFixture(name, "sse")),
				openaiResponsesAdapter(options),
			),
		),
	);
}

describe("openaiResponsesAdapter golden streams", () => {
	it("LSA-R26: text-basic.sse matches expected events", async () => {
		await expect(streamFixture("text-basic")).resolves.toEqual(
			expectedResponsesEvents("text-basic"),
		);
	});

	it("LSA-R27: function-call.sse matches expected events", async () => {
		await expect(streamFixture("function-call")).resolves.toEqual(
			expectedResponsesEvents("function-call"),
		);
	});

	it("LSA-R28: args-before-item.sse matches expected events", async () => {
		await expect(streamFixture("args-before-item")).resolves.toEqual(
			expectedResponsesEvents("args-before-item"),
		);
	});

	it("LSA-R29: refusal.sse matches expected events", async () => {
		await expect(streamFixture("refusal")).resolves.toEqual(expectedResponsesEvents("refusal"));
	});

	it("LSA-R30: failed.sse matches expected events", async () => {
		await expect(streamFixture("failed")).resolves.toEqual(expectedResponsesEvents("failed"));
	});

	it("LSA-R31: incomplete.sse matches expected events", async () => {
		await expect(streamFixture("incomplete")).resolves.toEqual(
			expectedResponsesEvents("incomplete"),
		);
	});

	it("LSA-R31b: json-mode.sse matches expected events", async () => {
		await expect(streamFixture("json-mode", { jsonMode: true })).resolves.toEqual(
			expectedResponsesEvents("json-mode"),
		);
	});

	it("LSA-R31c: parallel-function-call.sse matches expected events", async () => {
		await expect(streamFixture("parallel-function-call")).resolves.toEqual(
			expectedResponsesEvents("parallel-function-call"),
		);
	});
});
