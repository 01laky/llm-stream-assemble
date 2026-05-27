import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { openaiChatAdapter } from "../src/adapters/openai-chat";
import { openaiCompatibleAdapter } from "../src/adapters/openai-compatible";
import { assembleResponse } from "../src/core/assemble-response";
import { runAdapterGoldenStream } from "./helpers/adapter-conformance";
import { expectedCompatibleEvents, hostCompatibleFixture } from "./helpers/compatible-fixtures";
import {
	expectedOpenAIEvents,
	normalizeEvents,
	openAIJSONFixture,
} from "./helpers/openai-fixtures";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const openaiFixtures = join(rootDir, "test/fixtures/openai-chat");
const compatibleRoot = join(rootDir, "test/fixtures/openai-compatible");

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
});
