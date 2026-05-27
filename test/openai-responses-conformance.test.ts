import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { openaiResponsesAdapter } from "../src/adapters/openai-responses";
import { runAdapterGoldenStream } from "./helpers/adapter-conformance";
import { readExpectedEvents } from "./helpers/adapter-conformance";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures/openai-responses");

function normalizeResponsesEvents(events: unknown[]): unknown[] {
	return events.map((event) => {
		if (typeof event !== "object" || event === null) return event;
		const record = event as Record<string, unknown>;
		if (record.type === "metadata" || record.type === "usage" || record.type === "logprob") {
			const { raw: _raw, ...rest } = record;
			if ("choiceIndex" in rest && rest.choiceIndex === 0) {
				const { choiceIndex: _choiceIndex, ...withoutChoice } = rest;
				return withoutChoice;
			}
			return rest;
		}
		if (record.type === "error") {
			return { type: "error", recoverable: record.recoverable };
		}
		if ("choiceIndex" in record && record.choiceIndex === 0) {
			const { choiceIndex: _choiceIndex, ...rest } = record;
			return rest;
		}
		return event;
	});
}

describe("openaiResponsesAdapter shared conformance harness", () => {
	it("LSA-R32: runAdapterGoldenStream parity for text-basic and function-call SSE fixtures", async () => {
		for (const name of ["text-basic", "function-call"] as const) {
			const events = normalizeResponsesEvents(
				await runAdapterGoldenStream({
					adapter: openaiResponsesAdapter(),
					fixtureSsePath: join(fixturesDir, `${name}.sse`),
					expectedEventsPath: join(fixturesDir, `${name}.expected.json`),
				}),
			);
			expect(events).toEqual(readExpectedEvents(join(fixturesDir, `${name}.expected.json`)));
		}
	});
});

describe("openaiResponsesAdapter logprobs conformance extension", () => {
	it("LSA-R71: runAdapterGoldenStream parity for logprobs-stream", async () => {
		const events = normalizeResponsesEvents(
			await runAdapterGoldenStream({
				adapter: openaiResponsesAdapter(),
				fixtureSsePath: join(fixturesDir, "logprobs-stream.sse"),
				expectedEventsPath: join(fixturesDir, "logprobs-stream.expected.json"),
			}),
		);
		expect(events.some((event) => (event as { type?: string }).type === "logprob")).toBe(true);
	});

	it("LSA-R72: unified logprob StreamEvent shape from Responses stream", async () => {
		const events = normalizeResponsesEvents(
			await runAdapterGoldenStream({
				adapter: openaiResponsesAdapter(),
				fixtureSsePath: join(fixturesDir, "logprobs-stream.sse"),
				expectedEventsPath: join(fixturesDir, "logprobs-stream.expected.json"),
			}),
		);
		const logprob = events.find((event) => (event as { type?: string }).type === "logprob") as {
			type: string;
			channel: string;
			token: string;
			logprob: number;
		};
		expect(logprob).toMatchObject({
			type: "logprob",
			channel: "content",
			token: "Hello",
			logprob: -0.12,
		});
	});

	it("LSA-R73: post-finish logprob drop on Responses stream", async () => {
		const events = normalizeResponsesEvents(
			await runAdapterGoldenStream({
				adapter: openaiResponsesAdapter(),
				fixtureSsePath: join(fixturesDir, "logprobs-failed-stream.sse"),
				expectedEventsPath: join(fixturesDir, "logprobs-failed-stream.expected.json"),
			}),
		);
		const errorIndex = events.findIndex((event) => (event as { type?: string }).type === "error");
		expect(errorIndex).toBeGreaterThan(0);
		expect(
			events
				.slice(errorIndex + 1)
				.every((event) => (event as { type?: string }).type !== "logprob"),
		).toBe(true);
	});
});
