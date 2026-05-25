import { describe, expect, it } from "vitest";
import { openaiCompatibleAdapter } from "../src/adapters/openai-compatible";
import { assembleResponse } from "../src/core/assemble-response";
import { assembleStream } from "../src/core/assemble-stream";
import { byteStreamFromStrings, collectAsync } from "./helpers/collect-events";
import {
	compatibleJSONFixture,
	compatibleTextFixture,
	expectedCompatibleEvents,
	normalizeCompatibleEvents,
} from "./helpers/compatible-fixtures";

async function streamFixture(name: string, options = {}) {
	return normalizeCompatibleEvents(
		await collectAsync(
			assembleStream(
				byteStreamFromStrings(compatibleTextFixture(name, "sse")),
				openaiCompatibleAdapter(options),
			),
		),
	);
}

function responseFixture(name: string, options = {}) {
	return normalizeCompatibleEvents(
		assembleResponse(compatibleJSONFixture(name), openaiCompatibleAdapter(options)),
	);
}

describe("openaiCompatibleAdapter golden fixtures", () => {
	it("LSA-OC31: generic-text.sse matches expected events", async () => {
		await expect(streamFixture("generic-text")).resolves.toEqual(
			expectedCompatibleEvents("generic-text"),
		);
	});

	it("LSA-OC32: missing-metadata.sse matches expected events", async () => {
		await expect(streamFixture("missing-metadata")).resolves.toEqual(
			expectedCompatibleEvents("missing-metadata"),
		);
	});

	it("LSA-OC33: missing-choice-index.sse matches expected events", async () => {
		await expect(streamFixture("missing-choice-index")).resolves.toEqual(
			expectedCompatibleEvents("missing-choice-index"),
		);
	});

	it("LSA-OC34: missing-tool-id.sse matches expected events", async () => {
		await expect(streamFixture("missing-tool-id")).resolves.toEqual(
			expectedCompatibleEvents("missing-tool-id"),
		);
	});

	it("LSA-OC35: loose-error-string.sse matches expected events", async () => {
		await expect(streamFixture("loose-error-string")).resolves.toEqual(
			expectedCompatibleEvents("loose-error-string"),
		);
	});

	it("LSA-OC36: reasoning-alias.sse matches expected events", async () => {
		await expect(streamFixture("reasoning-alias")).resolves.toEqual(
			expectedCompatibleEvents("reasoning-alias"),
		);
	});

	it("LSA-OC37: usage-alias.sse matches expected events", async () => {
		await expect(streamFixture("usage-alias")).resolves.toEqual(
			expectedCompatibleEvents("usage-alias"),
		);
	});

	it("LSA-OC38: json-mode.sse matches expected events", async () => {
		await expect(streamFixture("json-mode", { jsonMode: true })).resolves.toEqual(
			expectedCompatibleEvents("json-mode"),
		);
	});

	it("LSA-OC39: response-generic.json matches expected events", () => {
		expect(responseFixture("response-generic")).toEqual(
			expectedCompatibleEvents("response-generic"),
		);
	});

	it("LSA-OC40: response-loose-error.json matches expected events", () => {
		expect(responseFixture("response-loose-error")).toEqual(
			expectedCompatibleEvents("response-loose-error"),
		);
	});
});
