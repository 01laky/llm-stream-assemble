import { describe, expect, it } from "vitest";
import { openaiChatAdapter, type OpenAIChatAdapterOptions } from "../src/adapters/openai-chat";
import { assembleStream } from "../src/core/assemble-stream";
import { byteStreamFromStrings, collectAsync } from "./helpers/collect-events";
import {
	expectedOpenAIEvents,
	normalizeEvents,
	openAITextFixture,
} from "./helpers/openai-fixtures";

async function assembledFixture(name: string, options?: OpenAIChatAdapterOptions) {
	return normalizeEvents(
		await collectAsync(
			assembleStream(
				byteStreamFromStrings(openAITextFixture(name, "sse")),
				openaiChatAdapter(options),
			),
		),
	);
}

describe("openaiChatAdapter golden stream fixtures", () => {
	it("LSA-O35: text-basic.sse matches expected events", async () => {
		await expect(assembledFixture("text-basic")).resolves.toEqual(
			expectedOpenAIEvents("text-basic"),
		);
	});

	it("LSA-O36: tool-single.sse matches expected events", async () => {
		await expect(assembledFixture("tool-single")).resolves.toEqual(
			expectedOpenAIEvents("tool-single"),
		);
	});

	it("LSA-O37: tool-parallel.sse matches expected events", async () => {
		await expect(assembledFixture("tool-parallel")).resolves.toEqual(
			expectedOpenAIEvents("tool-parallel"),
		);
	});

	it("LSA-O38: legacy-function-call.sse matches expected events", async () => {
		await expect(assembledFixture("legacy-function-call")).resolves.toEqual(
			expectedOpenAIEvents("legacy-function-call"),
		);
	});

	it("LSA-O39: refusal.sse matches expected events", async () => {
		await expect(assembledFixture("refusal")).resolves.toEqual(expectedOpenAIEvents("refusal"));
	});

	it("LSA-O40: usage.sse matches expected events", async () => {
		await expect(assembledFixture("usage")).resolves.toEqual(expectedOpenAIEvents("usage"));
	});

	it("LSA-O41: multichoice.sse documents current Phase 1 terminal behavior", async () => {
		await expect(assembledFixture("multichoice")).resolves.toEqual(
			expectedOpenAIEvents("multichoice"),
		);
	});

	it("LSA-O42: provider-error.sse matches expected events", async () => {
		await expect(assembledFixture("provider-error")).resolves.toEqual(
			expectedOpenAIEvents("provider-error"),
		);
	});

	it("LSA-O43: json-mode.sse matches expected events with jsonMode", async () => {
		await expect(assembledFixture("json-mode", { jsonMode: true })).resolves.toEqual(
			expectedOpenAIEvents("json-mode"),
		);
	});
});
