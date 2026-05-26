import { describe, expect, it } from "vitest";
import { openaiCompatibleAdapter } from "../src/adapters/openai-compatible";
import { assembleStream } from "../src/core/assemble-stream";
import { byteStreamFromStrings, collectAsync } from "./helpers/collect-events";
import {
	ALL_COMPATIBLE_PROVIDERS,
	hostCompatibleFixture,
	normalizeCompatibleEvents,
} from "./helpers/compatible-fixtures";

describe("openaiCompatibleAdapter host preset edge cases", () => {
	it("LSA-OC73: ALL_COMPATIBLE_PROVIDERS covers every OpenAICompatibleProvider key", () => {
		expect(ALL_COMPATIBLE_PROVIDERS).toEqual([
			"generic",
			"openrouter",
			"groq",
			"deepseek",
			"mistral",
			"ollama",
			"lmstudio",
			"together",
			"fireworks",
		]);
		for (const provider of ALL_COMPATIBLE_PROVIDERS) {
			expect(openaiCompatibleAdapter({ provider }).parseChunk("{}")).toEqual([]);
		}
	});

	it("LSA-OC74: provider preset does not change error prefix", () => {
		expect(() => openaiCompatibleAdapter({ provider: "deepseek" }).parseChunk("{not-json")).toThrow(
			/^llm-stream-assemble: openaiCompatibleAdapter\.parseChunk/,
		);
		expect(() => openaiCompatibleAdapter({ provider: "mistral" }).parseChunk("{not-json")).toThrow(
			/^llm-stream-assemble: openaiCompatibleAdapter\.parseChunk/,
		);
	});

	it("LSA-OC75: strict mode behaves same across deepseek and mistral presets", () => {
		const strictDeepseek = openaiCompatibleAdapter({
			provider: "deepseek",
			allowMissingMetadata: false,
		});
		const strictMistral = openaiCompatibleAdapter({
			provider: "mistral",
			allowMissingMetadata: false,
		});
		expect(() => strictDeepseek.parseChunk(JSON.stringify({ foo: "bar" }))).toThrow(
			/openaiCompatibleAdapter\.parseChunk/,
		);
		expect(() => strictMistral.parseChunk(JSON.stringify({ foo: "bar" }))).toThrow(
			/openaiCompatibleAdapter\.parseChunk/,
		);
		const valid = JSON.stringify({
			id: "x",
			model: "m",
			choices: [{ delta: { content: "ok" } }],
		});
		expect(strictDeepseek.parseChunk(valid)).toContainEqual({
			kind: "text-delta",
			text: "ok",
			choiceIndex: 0,
		});
		expect(strictMistral.parseChunk(valid)).toContainEqual({
			kind: "text-delta",
			text: "ok",
			choiceIndex: 0,
		});
	});

	it("LSA-OC76: jsonMode on deepseek text fixture maps content to json events", async () => {
		const sse = hostCompatibleFixture("deepseek", "text-basic", "sse") as string;
		const events = normalizeCompatibleEvents(
			await collectAsync(
				assembleStream(
					byteStreamFromStrings(sse),
					openaiCompatibleAdapter({ provider: "deepseek", jsonMode: true }),
				),
			),
		);
		expect(events.some((event) => (event as { type?: string }).type === "json.delta")).toBe(true);
		expect(events.some((event) => (event as { type?: string }).type === "text.delta")).toBe(false);
	});
});
