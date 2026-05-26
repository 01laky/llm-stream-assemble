import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { openaiChatAdapter } from "../src/adapters/openai-chat";
import { anthropicAdapter } from "../src/adapters/anthropic";
import { geminiAdapter } from "../src/adapters/gemini";
import { assembleFromFile } from "../src/core/assemble-from-file";
import { collectAsync } from "./helpers/collect-events";
import { normalizeEvents } from "./helpers/openai-fixtures";
import { normalizeAnthropicEvents } from "./helpers/anthropic-fixtures";
import { normalizeGeminiEvents } from "./helpers/gemini-fixtures";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const openAIStream = join(rootDir, "test/fixtures/openai-chat/text-basic.sse");
const openAIResponse = join(rootDir, "test/fixtures/openai-chat/response-text.json");
const anthropicStream = join(rootDir, "test/fixtures/anthropic/text-basic.sse");
const geminiStream = join(rootDir, "test/fixtures/gemini/text-basic.sse");
const transformsDir = join(rootDir, "test/fixtures/transforms");

describe("assembleFromFile", () => {
	it("LSA-T29: replays .sse fixture with OpenAI Chat adapter", async () => {
		const events = normalizeEvents(
			await collectAsync(assembleFromFile(openAIStream, openaiChatAdapter())),
		);
		expect(events.at(-1)).toEqual({ type: "finish", reason: "stop" });
		expect(events).toContainEqual({ type: "text.done", text: "Hello world" });
	});

	it("LSA-T30: replays .json fixture with OpenAI Chat adapter", async () => {
		const events = normalizeEvents(
			await collectAsync(assembleFromFile(openAIResponse, openaiChatAdapter())),
		);
		expect(events).toContainEqual({ type: "text.done", text: "Hello response" });
	});

	it("LSA-T31: replays .sse fixture with Anthropic adapter", async () => {
		const events = normalizeAnthropicEvents(
			await collectAsync(assembleFromFile(anthropicStream, anthropicAdapter())),
		);
		expect(events).toContainEqual({ type: "text.done", text: "Hello Claude" });
	});

	it("LSA-T31b: replays gemini text-basic.sse with normalizeGeminiEvents", async () => {
		const events = normalizeGeminiEvents(
			await collectAsync(assembleFromFile(geminiStream, geminiAdapter())),
		);
		expect(events.at(-1)).toMatchObject({ type: "finish", reason: "stop" });
		expect(events).toContainEqual({ type: "text.done", text: "Hello Gemini" });
	});

	it("LSA-T32: format sse overrides extension", async () => {
		const events = normalizeEvents(
			await collectAsync(
				assembleFromFile(
					join(transformsDir, "text-as-custom-extension.fixture"),
					openaiChatAdapter(),
					{ format: "sse" },
				),
			),
		);
		expect(events).toContainEqual({ type: "text.done", text: "Custom extension" });
	});

	it("LSA-T33: format json overrides extension", async () => {
		const events = normalizeEvents(
			await collectAsync(
				assembleFromFile(
					join(transformsDir, "text-json-as-custom-extension.fixture"),
					openaiChatAdapter(),
					{ format: "json" },
				),
			),
		);
		expect(events).toContainEqual({ type: "text.done", text: "Custom JSON extension" });
	});

	it("LSA-T34: unknown extension throws prefixed error", async () => {
		await expect(
			collectAsync(assembleFromFile(join(transformsDir, "unknown.fixture"), openaiChatAdapter())),
		).rejects.toThrow(/^llm-stream-assemble: assembleFromFile cannot infer format/);
	});

	it("LSA-T35: missing file throws prefixed error with path", async () => {
		const missing = join(transformsDir, "missing.sse");
		await expect(collectAsync(assembleFromFile(missing, openaiChatAdapter()))).rejects.toThrow(
			new RegExp(`llm-stream-assemble: assembleFromFile failed to read .*missing\\.sse`),
		);
	});

	it("LSA-T36: invalid JSON file throws prefixed error with path", async () => {
		await expect(
			collectAsync(assembleFromFile(join(transformsDir, "invalid.json"), openaiChatAdapter())),
		).rejects.toThrow(/llm-stream-assemble: assembleFromFile failed to parse JSON .*invalid\.json/);
	});

	it("LSA-T37: passes recoverMalformed through to assembly", async () => {
		const file = join(transformsDir, "malformed.sse");
		await writeFile(file, "data: bad\n\ndata: [DONE]\n\n", "utf8");
		const events = await collectAsync(
			assembleFromFile(
				file,
				{
					parseChunk() {
						throw new Error("bad payload");
					},
				},
				{ recoverMalformed: true },
			),
		);
		expect(events[0]).toMatchObject({ type: "error", recoverable: true });
	});

	it("LSA-T38: result async iterable is single-use; call function again to replay", async () => {
		const iterable = assembleFromFile(openAIStream, openaiChatAdapter());
		expect(await collectAsync(iterable)).not.toEqual([]);
		expect(await collectAsync(iterable)).toEqual([]);
		expect(await collectAsync(assembleFromFile(openAIStream, openaiChatAdapter()))).not.toEqual([]);
	});

	it("LSA-T38b: root and core dist imports still work with Node-only assembleFromFile", async () => {
		const root = (await import(join(rootDir, "dist/index.js"))) as { assembleFromFile: unknown };
		const core = (await import(join(rootDir, "dist/core/index.js"))) as {
			assembleFromFile: unknown;
		};
		expect(typeof root.assembleFromFile).toBe("function");
		expect(typeof core.assembleFromFile).toBe("function");
	});

	it("LSA-T38c: aborted signal passes through for sse replay", async () => {
		const controller = new AbortController();
		controller.abort();
		const events = await collectAsync(
			assembleFromFile(openAIStream, openaiChatAdapter(), { signal: controller.signal }),
		);
		expect(events.at(-1)).toEqual({ type: "finish", reason: "aborted" });
	});
});
