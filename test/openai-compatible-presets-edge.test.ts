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
			"perplexity",
			"xai",
			"azure",
			"cloudflare",
		]);
		for (const provider of ALL_COMPATIBLE_PROVIDERS) {
			if (provider === "azure") {
				expect(() => openaiCompatibleAdapter({ provider }).parseChunk("{}")).toThrow(
					/openaiCompatibleAdapter\.parseChunk/,
				);
			} else {
				expect(openaiCompatibleAdapter({ provider }).parseChunk("{}")).toEqual([]);
			}
		}
	});

	it("LSA-OC74: provider preset does not change error prefix", () => {
		expect(() => openaiCompatibleAdapter({ provider: "deepseek" }).parseChunk("{not-json")).toThrow(
			/^llm-stream-assemble: openaiCompatibleAdapter\.parseChunk/,
		);
		expect(() => openaiCompatibleAdapter({ provider: "mistral" }).parseChunk("{not-json")).toThrow(
			/^llm-stream-assemble: openaiCompatibleAdapter\.parseChunk/,
		);
		expect(() =>
			openaiCompatibleAdapter({ provider: "perplexity" }).parseChunk("{not-json"),
		).toThrow(/^llm-stream-assemble: openaiCompatibleAdapter\.parseChunk/);
		expect(() => openaiCompatibleAdapter({ provider: "xai" }).parseChunk("{not-json")).toThrow(
			/^llm-stream-assemble: openaiCompatibleAdapter\.parseChunk/,
		);
		expect(() => openaiCompatibleAdapter({ provider: "azure" }).parseChunk("{not-json")).toThrow(
			/^llm-stream-assemble: openaiCompatibleAdapter\.parseChunk/,
		);
		expect(() =>
			openaiCompatibleAdapter({ provider: "cloudflare" }).parseChunk("{not-json"),
		).toThrow(/^llm-stream-assemble: openaiCompatibleAdapter\.parseChunk/);
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

	it("LSA-OC98: strict mode behaves same across perplexity and xai presets", () => {
		const strictPerplexity = openaiCompatibleAdapter({
			provider: "perplexity",
			allowMissingMetadata: false,
		});
		const strictXai = openaiCompatibleAdapter({
			provider: "xai",
			allowMissingMetadata: false,
		});
		expect(() => strictPerplexity.parseChunk(JSON.stringify({ foo: "bar" }))).toThrow(
			/openaiCompatibleAdapter\.parseChunk/,
		);
		expect(() => strictXai.parseChunk(JSON.stringify({ foo: "bar" }))).toThrow(
			/openaiCompatibleAdapter\.parseChunk/,
		);
		const valid = JSON.stringify({
			id: "x",
			model: "m",
			choices: [{ delta: { content: "ok" } }],
		});
		expect(strictPerplexity.parseChunk(valid)).toContainEqual({
			kind: "text-delta",
			text: "ok",
			choiceIndex: 0,
		});
		expect(strictXai.parseChunk(valid)).toContainEqual({
			kind: "text-delta",
			text: "ok",
			choiceIndex: 0,
		});
	});

	it("LSA-OC99: perplexity citations-stream parseChunk preserves citations in metadata.raw", () => {
		const raw = hostCompatibleFixture("perplexity", "citations-stream", "sse") as string;
		const dataLine = raw
			.split("\n")
			.find((line) => line.startsWith("data: ") && !line.includes("[DONE]"))!;
		const payload = dataLine.slice("data: ".length);
		const chunks = openaiCompatibleAdapter({ provider: "perplexity" }).parseChunk(payload);
		const metadata = chunks.find((chunk) => chunk.kind === "metadata");
		expect(metadata).toBeDefined();
		expect((metadata as { raw?: { citations?: string[] } }).raw?.citations).toEqual([
			"https://example.com/a",
			"https://example.com/b",
		]);
	});

	it("LSA-OC100: error prefix unchanged for perplexity, xai, and cloudflare malformed JSON", () => {
		for (const provider of ["perplexity", "xai", "cloudflare"] as const) {
			expect(() => openaiCompatibleAdapter({ provider }).parseChunk("{bad-json")).toThrow(
				/^llm-stream-assemble: openaiCompatibleAdapter\.parseChunk/,
			);
		}
	});

	it("LSA-OC110: perplexity, xai, and cloudflare ignore unknown non-text delta keys without throw", () => {
		const multimodal = JSON.stringify({
			choices: [
				{
					delta: {
						content: "visible",
						images: [{ url: "https://example.com/img.png" }],
						search_results: [],
					},
				},
			],
		});
		for (const provider of ["perplexity", "xai", "cloudflare"] as const) {
			expect(() => openaiCompatibleAdapter({ provider }).parseChunk(multimodal)).not.toThrow();
			expect(openaiCompatibleAdapter({ provider }).parseChunk(multimodal)).toContainEqual({
				kind: "text-delta",
				text: "visible",
				choiceIndex: 0,
			});
		}
	});

	it("LSA-OC123: azure preset default rejects wholly unrecognizable payload", () => {
		const unrecognizable = JSON.stringify({ foo: "bar" });
		expect(() => openaiCompatibleAdapter({ provider: "azure" }).parseChunk(unrecognizable)).toThrow(
			/openaiCompatibleAdapter\.parseChunk/,
		);
		expect(openaiCompatibleAdapter({ provider: "generic" }).parseChunk(unrecognizable)).toEqual([]);
	});

	it("LSA-OC124: azure content-filter parseChunk preserves filter fields in metadata.raw", () => {
		const raw = hostCompatibleFixture("azure", "content-filter-metadata", "sse") as string;
		const dataLine = raw
			.split("\n")
			.find((line) => line.startsWith("data: ") && !line.includes("[DONE]"))!;
		const payload = dataLine.slice("data: ".length);
		const chunks = openaiCompatibleAdapter({ provider: "azure" }).parseChunk(payload);
		const metadata = chunks.find((chunk) => chunk.kind === "metadata");
		expect(metadata).toBeDefined();
		const rawBody = (metadata as { raw?: Record<string, unknown> }).raw;
		expect(rawBody?.prompt_filter_results).toBeDefined();
		expect(
			(rawBody?.choices as Array<{ content_filter_results?: unknown }>)?.[0]
				?.content_filter_results,
		).toBeDefined();
	});

	it("LSA-OC126: azure preset ignores unknown non-text delta keys without throw", () => {
		const multimodal = JSON.stringify({
			id: "x",
			model: "m",
			choices: [
				{
					delta: {
						content: "visible",
						images: [{ url: "https://example.com/img.png" }],
					},
				},
			],
		});
		expect(() =>
			openaiCompatibleAdapter({ provider: "azure" }).parseChunk(multimodal),
		).not.toThrow();
		expect(openaiCompatibleAdapter({ provider: "azure" }).parseChunk(multimodal)).toContainEqual({
			kind: "text-delta",
			text: "visible",
			choiceIndex: 0,
		});
	});

	it("LSA-OC141: azure allowMissingMetadata override accepts unrecognizable payload", () => {
		const unrecognizable = JSON.stringify({ foo: "bar" });
		expect(
			openaiCompatibleAdapter({ provider: "azure", allowMissingMetadata: true }).parseChunk(
				unrecognizable,
			),
		).toEqual([]);
	});

	it("LSA-OC151: cloudflare malformed JSON throws openaiCompatibleAdapter.parseChunk", () => {
		expect(() =>
			openaiCompatibleAdapter({ provider: "cloudflare" }).parseChunk("{not-json"),
		).toThrow(/^llm-stream-assemble: openaiCompatibleAdapter\.parseChunk/);
	});

	it("LSA-OC152: cloudflare preset ignores unknown non-text delta keys without throw", () => {
		const multimodal = JSON.stringify({
			id: "cf-1",
			model: "@cf/meta/llama-3.1-8b-instruct",
			choices: [
				{
					delta: {
						content: "visible",
						images: [{ url: "https://example.com/img.png" }],
					},
				},
			],
		});
		expect(() =>
			openaiCompatibleAdapter({ provider: "cloudflare" }).parseChunk(multimodal),
		).not.toThrow();
		expect(
			openaiCompatibleAdapter({ provider: "cloudflare" }).parseChunk(multimodal),
		).toContainEqual({
			kind: "text-delta",
			text: "visible",
			choiceIndex: 0,
		});
	});

	it("LSA-OC153: cloudflare usage-stream parseChunk preserves usage fields", () => {
		const raw = hostCompatibleFixture("cloudflare", "usage-stream", "sse") as string;
		const usageLine = raw
			.split("\n")
			.find((line) => line.includes('"usage"') && line.startsWith("data: "))!;
		const payload = usageLine.slice("data: ".length);
		const chunks = openaiCompatibleAdapter({ provider: "cloudflare" }).parseChunk(payload);
		const usage = chunks.find((chunk) => chunk.kind === "usage");
		expect(usage).toBeDefined();
		expect(usage).toMatchObject({
			kind: "usage",
			inputTokens: 10,
			outputTokens: 3,
		});
	});

	it("LSA-OC154: cloudflare vs generic on unrecognizable payload — both return empty", () => {
		const unrecognizable = JSON.stringify({});
		expect(openaiCompatibleAdapter({ provider: "cloudflare" }).parseChunk(unrecognizable)).toEqual(
			[],
		);
		expect(openaiCompatibleAdapter({ provider: "generic" }).parseChunk(unrecognizable)).toEqual([]);
	});
});
