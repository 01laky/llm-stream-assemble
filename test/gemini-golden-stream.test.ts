import { describe, expect, it } from "vitest";
import { geminiAdapter } from "../src/adapters/gemini";
import { assembleStream } from "../src/core/assemble-stream";
import { byteStreamFromStrings, collectAsync } from "./helpers/collect-events";
import {
	expectedGeminiEvents,
	geminiTextFixture,
	normalizeGeminiEvents,
} from "./helpers/gemini-fixtures";

async function streamFixture(name: string, jsonMode: boolean) {
	return normalizeGeminiEvents(
		await collectAsync(
			assembleStream(
				byteStreamFromStrings(geminiTextFixture(name, "sse")),
				geminiAdapter({ jsonMode }),
			),
		),
	);
}

describe("geminiAdapter golden stream fixtures", () => {
	it("LSA-G36: empty-candidates.sse matches expected events", async () => {
		await expect(streamFixture("empty-candidates", false)).resolves.toEqual(
			expectedGeminiEvents("empty-candidates"),
		);
	});

	it("LSA-G37: finish-max-tokens.sse matches expected events", async () => {
		await expect(streamFixture("finish-max-tokens", false)).resolves.toEqual(
			expectedGeminiEvents("finish-max-tokens"),
		);
	});

	it("LSA-G38: finish-safety.sse matches expected events", async () => {
		await expect(streamFixture("finish-safety", false)).resolves.toEqual(
			expectedGeminiEvents("finish-safety"),
		);
	});

	it("LSA-G39: incomplete.sse matches expected events", async () => {
		await expect(streamFixture("incomplete", false)).resolves.toEqual(
			expectedGeminiEvents("incomplete"),
		);
	});

	it("LSA-G40: json-mode.sse matches expected events", async () => {
		await expect(streamFixture("json-mode", true)).resolves.toEqual(expectedGeminiEvents("json-mode"));
	});

	it("LSA-G41: metadata-early.sse matches expected events", async () => {
		await expect(streamFixture("metadata-early", false)).resolves.toEqual(
			expectedGeminiEvents("metadata-early"),
		);
	});

	it("LSA-G42: prompt-blocked.sse matches expected events", async () => {
		await expect(streamFixture("prompt-blocked", false)).resolves.toEqual(
			expectedGeminiEvents("prompt-blocked"),
		);
	});

	it("LSA-G43: provider-error.sse matches expected events", async () => {
		await expect(streamFixture("provider-error", false)).resolves.toEqual(
			expectedGeminiEvents("provider-error"),
		);
	});

	it("LSA-G44: thinking.sse matches expected events", async () => {
		await expect(streamFixture("thinking", false)).resolves.toEqual(
			expectedGeminiEvents("thinking"),
		);
	});

	it("LSA-G45: text-basic.sse matches expected events", async () => {
		await expect(streamFixture("text-basic", false)).resolves.toEqual(
			expectedGeminiEvents("text-basic"),
		);
	});

	it("LSA-G46: text-empty-parts.sse matches expected events", async () => {
		await expect(streamFixture("text-empty-parts", false)).resolves.toEqual(
			expectedGeminiEvents("text-empty-parts"),
		);
	});

	it("LSA-G47: text-unicode.sse matches expected events", async () => {
		await expect(streamFixture("text-unicode", false)).resolves.toEqual(
			expectedGeminiEvents("text-unicode"),
		);
	});

	it("LSA-G48: tool-args-object.sse matches expected events", async () => {
		await expect(streamFixture("tool-args-object", false)).resolves.toEqual(
			expectedGeminiEvents("tool-args-object"),
		);
	});

	it("LSA-G49: tool-flush-without-terminal.sse matches expected events", async () => {
		await expect(streamFixture("tool-flush-without-terminal", false)).resolves.toEqual(
			expectedGeminiEvents("tool-flush-without-terminal"),
		);
	});

	it("LSA-G50: tool-name-before-args.sse matches expected events", async () => {
		await expect(streamFixture("tool-name-before-args", false)).resolves.toEqual(
			expectedGeminiEvents("tool-name-before-args"),
		);
	});

	it("LSA-G51: tool-partial-args.sse matches expected events", async () => {
		await expect(streamFixture("tool-partial-args", false)).resolves.toEqual(
			expectedGeminiEvents("tool-partial-args"),
		);
	});

	it("LSA-G52: usage-only.sse matches expected events", async () => {
		await expect(streamFixture("usage-only", false)).resolves.toEqual(
			expectedGeminiEvents("usage-only"),
		);
	});
});
