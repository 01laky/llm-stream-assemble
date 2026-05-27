import { describe, expect, it } from "vitest";
import { bedrockAdapter } from "../src/adapters/bedrock";
import { assembleFromPayloads } from "../src/core/assemble-payloads";
import { assembleStream } from "../src/core/assemble-stream";
import { byteStreamFromStrings, collectAsync } from "./helpers/collect-events";
import {
	bedrockJsonlLines,
	bedrockTextFixture,
	expectedBedrockEvents,
	normalizeBedrockEvents,
} from "./helpers/bedrock-fixtures";

async function jsonlFixture(name: string, options: Parameters<typeof bedrockAdapter>[0] = {}) {
	async function* payloads() {
		for (const line of bedrockJsonlLines(name)) yield line;
	}
	return normalizeBedrockEvents(
		await collectAsync(assembleFromPayloads(payloads(), bedrockAdapter(options))),
	);
}

async function sseFixture(name: string, options: Parameters<typeof bedrockAdapter>[0] = {}) {
	return normalizeBedrockEvents(
		await collectAsync(
			assembleStream(
				byteStreamFromStrings(bedrockTextFixture(name, "sse")),
				bedrockAdapter(options),
			),
		),
	);
}

describe("bedrockAdapter golden stream fixtures", () => {
	it("LSA-B01: text-basic.jsonl matches expected events", async () => {
		await expect(jsonlFixture("text-basic")).resolves.toEqual(expectedBedrockEvents("text-basic"));
	});

	it("LSA-B02: text-unicode.jsonl matches expected events", async () => {
		await expect(jsonlFixture("text-unicode")).resolves.toEqual(
			expectedBedrockEvents("text-unicode"),
		);
	});

	it("LSA-B03: tool-single.jsonl matches expected events", async () => {
		await expect(jsonlFixture("tool-single")).resolves.toEqual(
			expectedBedrockEvents("tool-single"),
		);
	});

	it("LSA-B04: tool-parallel.jsonl matches expected events", async () => {
		await expect(jsonlFixture("tool-parallel")).resolves.toEqual(
			expectedBedrockEvents("tool-parallel"),
		);
	});

	it("LSA-B05: tool-partial-input.jsonl matches expected events", async () => {
		await expect(jsonlFixture("tool-partial-input")).resolves.toEqual(
			expectedBedrockEvents("tool-partial-input"),
		);
	});

	it("LSA-B06: json-mode.jsonl matches expected events", async () => {
		await expect(jsonlFixture("json-mode", { jsonMode: true })).resolves.toEqual(
			expectedBedrockEvents("json-mode"),
		);
	});

	it("LSA-B07: provider-error.jsonl matches expected events", async () => {
		await expect(jsonlFixture("provider-error")).resolves.toEqual(
			expectedBedrockEvents("provider-error"),
		);
	});

	it("LSA-B08: usage-metadata.jsonl matches expected events", async () => {
		await expect(jsonlFixture("usage-metadata")).resolves.toEqual(
			expectedBedrockEvents("usage-metadata"),
		);
	});

	it("LSA-B09: incomplete.jsonl matches expected events", async () => {
		await expect(jsonlFixture("incomplete")).resolves.toEqual(expectedBedrockEvents("incomplete"));
	});

	it("LSA-B10: nova-text-basic.jsonl matches expected events", async () => {
		await expect(jsonlFixture("nova-text-basic", { modelFamily: "nova" })).resolves.toEqual(
			expectedBedrockEvents("nova-text-basic"),
		);
	});

	it("LSA-B11: guardrail-intervened.jsonl maps content_filter finish", async () => {
		await expect(jsonlFixture("guardrail-intervened")).resolves.toEqual(
			expectedBedrockEvents("guardrail-intervened"),
		);
		async function* payloads() {
			for (const line of bedrockJsonlLines("guardrail-intervened")) yield line;
		}
		const full = await collectAsync(assembleFromPayloads(payloads(), bedrockAdapter()));
		expect(full.some((event) => event.type === "finish" && event.reason === "content_filter")).toBe(
			true,
		);
		expect(
			full.some(
				(event) =>
					event.type === "metadata" &&
					typeof event.raw === "object" &&
					event.raw !== null &&
					"trace" in (event.raw as Record<string, unknown>),
			),
		).toBe(true);
	});

	it("LSA-B34: text-basic.sse and jsonl produce identical normalized events", async () => {
		const jsonl = await jsonlFixture("text-basic");
		const sse = await sseFixture("text-basic");
		expect(sse).toEqual(jsonl);
		expect(sse).toEqual(expectedBedrockEvents("text-basic"));
	});

	it("LSA-B81: tool-single.sse matches expected events via assembleStream", async () => {
		await expect(sseFixture("tool-single")).resolves.toEqual(expectedBedrockEvents("tool-single"));
	});
});
