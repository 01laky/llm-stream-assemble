import { describe, expect, it } from "vitest";
import { anthropicAdapter } from "../src/adapters/anthropic";
import { assembleStream } from "../src/core/assemble-stream";
import { byteStreamFromStrings, collectAsync } from "./helpers/collect-events";
import {
	anthropicTextFixture,
	expectedAnthropicEvents,
	normalizeAnthropicEvents,
} from "./helpers/anthropic-fixtures";

async function streamFixture(name: string) {
	return normalizeAnthropicEvents(
		await collectAsync(
			assembleStream(byteStreamFromStrings(anthropicTextFixture(name, "sse")), anthropicAdapter()),
		),
	);
}

describe("anthropicAdapter golden stream fixtures", () => {
	it("LSA-A12: text-basic.sse matches expected events", async () => {
		await expect(streamFixture("text-basic")).resolves.toEqual(
			expectedAnthropicEvents("text-basic"),
		);
	});

	it("LSA-A13: tool-use.sse matches expected events", async () => {
		await expect(streamFixture("tool-use")).resolves.toEqual(expectedAnthropicEvents("tool-use"));
	});

	it("LSA-A14: thinking.sse matches expected events", async () => {
		await expect(streamFixture("thinking")).resolves.toEqual(expectedAnthropicEvents("thinking"));
	});

	it("LSA-A15: refusal.sse matches expected events", async () => {
		await expect(streamFixture("refusal")).resolves.toEqual(expectedAnthropicEvents("refusal"));
	});

	it("LSA-A16: provider-error.sse matches expected events", async () => {
		await expect(streamFixture("provider-error")).resolves.toEqual(
			expectedAnthropicEvents("provider-error"),
		);
	});
});
