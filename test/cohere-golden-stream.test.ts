import { describe, expect, it } from "vitest";
import { cohereAdapter } from "../src/adapters/cohere";
import { assembleFromPayloads } from "../src/core/assemble-payloads";
import { collectAsync } from "./helpers/collect-events";
import {
	assembleCohereJsonl,
	assembleCohereSse,
	cohereJsonlLines,
	expectedCohereEvents,
} from "./helpers/cohere-fixtures";

describe("cohereAdapter golden stream fixtures", () => {
	it("LSA-CO11: text-basic.jsonl matches expected events", async () => {
		await expect(assembleCohereJsonl("text-basic")).resolves.toEqual(
			expectedCohereEvents("text-basic"),
		);
	});

	it("LSA-CO12: text-unicode.jsonl matches expected events", async () => {
		await expect(assembleCohereJsonl("text-unicode")).resolves.toEqual(
			expectedCohereEvents("text-unicode"),
		);
	});

	it("LSA-CO13: tool-single.jsonl matches expected events", async () => {
		await expect(assembleCohereJsonl("tool-single")).resolves.toEqual(
			expectedCohereEvents("tool-single"),
		);
	});

	it("LSA-CO14: tool-parallel.jsonl matches expected events", async () => {
		await expect(assembleCohereJsonl("tool-parallel")).resolves.toEqual(
			expectedCohereEvents("tool-parallel"),
		);
	});

	it("LSA-CO15: tool-partial-input.jsonl matches expected events", async () => {
		await expect(assembleCohereJsonl("tool-partial-input")).resolves.toEqual(
			expectedCohereEvents("tool-partial-input"),
		);
	});

	it("LSA-CO16: json-mode.jsonl matches expected events", async () => {
		await expect(assembleCohereJsonl("json-mode", { jsonMode: true })).resolves.toEqual(
			expectedCohereEvents("json-mode"),
		);
	});

	it("LSA-CO17: provider-error.jsonl matches expected events", async () => {
		await expect(assembleCohereJsonl("provider-error")).resolves.toEqual(
			expectedCohereEvents("provider-error"),
		);
	});

	it("LSA-CO18: usage-only.jsonl matches expected events", async () => {
		await expect(assembleCohereJsonl("usage-only")).resolves.toEqual(
			expectedCohereEvents("usage-only"),
		);
	});

	it("LSA-CO19: incomplete.jsonl matches expected events", async () => {
		await expect(assembleCohereJsonl("incomplete")).resolves.toEqual(
			expectedCohereEvents("incomplete"),
		);
	});

	it("LSA-CO20: tool-plan.jsonl matches expected events", async () => {
		await expect(assembleCohereJsonl("tool-plan")).resolves.toEqual(
			expectedCohereEvents("tool-plan"),
		);
	});

	it("LSA-CO34: text-basic.sse and jsonl produce identical normalized events", async () => {
		const jsonl = await assembleCohereJsonl("text-basic");
		const sse = await assembleCohereSse("text-basic");
		expect(sse).toEqual(jsonl);
		expect(sse).toEqual(expectedCohereEvents("text-basic"));
	});

	it("LSA-CO81: tool-no-plan.jsonl matches expected events", async () => {
		await expect(assembleCohereJsonl("tool-no-plan")).resolves.toEqual(
			expectedCohereEvents("tool-no-plan"),
		);
	});

	it("LSA-CO20b: citations-stream.jsonl matches expected events", async () => {
		await expect(assembleCohereJsonl("citations-stream")).resolves.toEqual(
			expectedCohereEvents("citations-stream"),
		);
	});

	it("LSA-CO13b: tool-single.sse matches expected events via assembleStream", async () => {
		await expect(assembleCohereSse("tool-single")).resolves.toEqual(
			expectedCohereEvents("tool-single"),
		);
	});

	it("LSA-CO17b: provider-error maps error finish through assembly", async () => {
		async function* payloads() {
			for (const line of cohereJsonlLines("provider-error")) yield line;
		}
		const full = await collectAsync(assembleFromPayloads(payloads(), cohereAdapter()));
		expect(full.some((event) => event.type === "error")).toBe(true);
		expect(full.some((event) => event.type === "finish" && event.reason === "error")).toBe(true);
	});
});
