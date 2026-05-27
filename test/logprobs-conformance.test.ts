import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { openaiChatAdapter } from "../src/adapters/openai-chat";
import { openaiCompatibleAdapter } from "../src/adapters/openai-compatible";
import { openaiResponsesAdapter } from "../src/adapters/openai-responses";
import { assembleResponse } from "../src/core/assemble-response";
import { runAdapterGoldenStream } from "./helpers/adapter-conformance";
import { expectedCompatibleEvents, hostCompatibleFixture } from "./helpers/compatible-fixtures";
import {
	expectedOpenAIEvents,
	normalizeEvents,
	openAIJSONFixture,
} from "./helpers/openai-fixtures";
import { normalizeResponsesEvents } from "./helpers/responses-fixtures";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const openaiFixtures = join(rootDir, "test/fixtures/openai-chat");
const compatibleRoot = join(rootDir, "test/fixtures/openai-compatible");
const responsesFixtures = join(rootDir, "test/fixtures/openai-responses");

describe("logprobs conformance", () => {
	it("LSA-LF01: openaiChatAdapter logprobs-stream golden", async () => {
		const events = normalizeEvents(
			await runAdapterGoldenStream({
				adapter: openaiChatAdapter(),
				fixtureSsePath: join(openaiFixtures, "logprobs-stream.sse"),
				expectedEventsPath: join(openaiFixtures, "logprobs-stream.expected.json"),
			}),
		);
		expect(events).toEqual(expectedOpenAIEvents("logprobs-stream"));
		expect(events.some((event) => (event as { type?: string }).type === "logprob")).toBe(true);
	});

	it("LSA-LF02: openaiChatAdapter logprobs-response golden", () => {
		const events = normalizeEvents(
			assembleResponse(openAIJSONFixture("logprobs-response"), openaiChatAdapter()),
		);
		expect(events).toEqual(expectedOpenAIEvents("logprobs-response"));
	});

	it("LSA-LF03: compatible root logprobs-stream golden", async () => {
		const events = normalizeEvents(
			await runAdapterGoldenStream({
				adapter: openaiCompatibleAdapter(),
				fixtureSsePath: join(compatibleRoot, "logprobs-stream.sse"),
				expectedEventsPath: join(compatibleRoot, "logprobs-stream.expected.json"),
			}),
		);
		expect(events).toEqual(expectedCompatibleEvents("logprobs-stream"));
	});

	it("LSA-LF04: openaiChatAdapter conformance harness logprobs-stream parity", async () => {
		const events = normalizeEvents(
			await runAdapterGoldenStream({
				adapter: openaiChatAdapter(),
				fixtureSsePath: join(openaiFixtures, "logprobs-stream.sse"),
				expectedEventsPath: join(openaiFixtures, "logprobs-stream.expected.json"),
			}),
		);
		expect(events).toEqual(expectedOpenAIEvents("logprobs-stream"));
	});

	it("LSA-LF05: groq preset logprobs-stream golden", async () => {
		const events = normalizeEvents(
			await runAdapterGoldenStream({
				adapter: openaiCompatibleAdapter({ provider: "groq" }),
				fixtureSsePath: join(compatibleRoot, "groq/logprobs-stream.sse"),
				expectedEventsPath: join(compatibleRoot, "groq/logprobs-stream.expected.json"),
			}),
		);
		expect(events).toEqual(hostCompatibleFixture("groq", "logprobs-stream", "expected.json"));
	});

	it("LSA-LF06: openaiResponsesAdapter logprobs-stream golden", async () => {
		const events = normalizeResponsesEvents(
			await runAdapterGoldenStream({
				adapter: openaiResponsesAdapter(),
				fixtureSsePath: join(responsesFixtures, "logprobs-stream.sse"),
				expectedEventsPath: join(responsesFixtures, "logprobs-stream.expected.json"),
			}),
		);
		expect(events.some((event) => event.type === "logprob")).toBe(true);
	});

	it("LSA-LF07: openaiResponsesAdapter logprobs-response golden", () => {
		const events = normalizeResponsesEvents(
			assembleResponse(
				JSON.parse(readFileSync(join(responsesFixtures, "logprobs-response.json"), "utf8")),
				openaiResponsesAdapter(),
			),
		);
		expect(events).toEqual(
			JSON.parse(readFileSync(join(responsesFixtures, "logprobs-response.expected.json"), "utf8")),
		);
	});

	it("LSA-LF08: openaiResponsesAdapter logprobs-json-mode golden", async () => {
		const events = normalizeResponsesEvents(
			await runAdapterGoldenStream({
				adapter: openaiResponsesAdapter({ jsonMode: true }),
				fixtureSsePath: join(responsesFixtures, "logprobs-json-mode.sse"),
				expectedEventsPath: join(responsesFixtures, "logprobs-json-mode.expected.json"),
			}),
		);
		expect(events.some((event) => event.type === "json.delta")).toBe(true);
	});

	it("LSA-LF09: openaiResponsesAdapter logprobs-tool-stream golden", async () => {
		await runAdapterGoldenStream({
			adapter: openaiResponsesAdapter(),
			fixtureSsePath: join(responsesFixtures, "logprobs-tool-stream.sse"),
			expectedEventsPath: join(responsesFixtures, "logprobs-tool-stream.expected.json"),
		});
	});

	it("LSA-LF10: openaiResponsesAdapter logprobs-done-batch golden", async () => {
		await runAdapterGoldenStream({
			adapter: openaiResponsesAdapter(),
			fixtureSsePath: join(responsesFixtures, "logprobs-done-batch.sse"),
			expectedEventsPath: join(responsesFixtures, "logprobs-done-batch.expected.json"),
		});
	});

	it("LSA-LF11: openaiResponsesAdapter logprobs-multi-output golden", async () => {
		const events = normalizeResponsesEvents(
			await runAdapterGoldenStream({
				adapter: openaiResponsesAdapter(),
				fixtureSsePath: join(responsesFixtures, "logprobs-multi-output.sse"),
				expectedEventsPath: join(responsesFixtures, "logprobs-multi-output.expected.json"),
			}),
		);
		expect(events.some((event) => event.type === "logprob" && event.choiceIndex === 1)).toBe(true);
	});
});
