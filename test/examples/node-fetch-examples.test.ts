import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runAnthropicExample } from "../../examples/node-fetch/anthropic";
import { runAzureOpenAIExample } from "../../examples/node-fetch/azure-openai";
import { runGeminiExample } from "../../examples/node-fetch/gemini";
import { runOpenAIChatExample } from "../../examples/node-fetch/openai-chat";
import { runOpenAICompatibleExample } from "../../examples/node-fetch/openai-compatible";
import { runPerplexityExample } from "../../examples/node-fetch/perplexity";
import { runReplayFixtureExample } from "../../examples/node-fetch/replay-fixture";
import { runXaiExample } from "../../examples/node-fetch/xai";
import { fakeStreamingFetch, withEnv } from "./helpers";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "../..");
const openAISSE = readFileSync(join(rootDir, "test/fixtures/openai-chat/text-basic.sse"), "utf8");
const anthropicSSE = readFileSync(join(rootDir, "test/fixtures/anthropic/text-basic.sse"), "utf8");
const geminiSSE = readFileSync(join(rootDir, "test/fixtures/gemini/text-basic.sse"), "utf8");
const perplexitySSE = readFileSync(
	join(rootDir, "test/fixtures/openai-compatible/perplexity/text-basic.sse"),
	"utf8",
);
const xaiSSE = readFileSync(
	join(rootDir, "test/fixtures/openai-compatible/xai/text-basic.sse"),
	"utf8",
);
const azureSSE = readFileSync(
	join(rootDir, "test/fixtures/openai-compatible/azure/text-basic.sse"),
	"utf8",
);

describe("node fetch examples", () => {
	it("LSA-X01: OpenAI example exports function and does not run on import", () => {
		expect(typeof runOpenAIChatExample).toBe("function");
	});

	it("LSA-X02: OpenAI example throws clear error when OPENAI_API_KEY missing", async () => {
		await withEnv({ OPENAI_API_KEY: undefined }, async () => {
			await expect(
				runOpenAIChatExample({ fetchImpl: fakeStreamingFetch(openAISSE) }),
			).rejects.toThrow("OPENAI_API_KEY is required");
		});
	});

	it("LSA-X03: OpenAI example uses injected fake fetch", async () => {
		const output: string[] = [];
		await runOpenAIChatExample({
			apiKey: "test-key",
			fetchImpl: fakeStreamingFetch(openAISSE),
			write: (text) => output.push(text),
		});
		expect(output.join("")).toContain("Hello world");
	});

	it("LSA-X04: OpenAI example streams fixture response and consumes events", async () => {
		const output: string[] = [];
		await runOpenAIChatExample({
			apiKey: "test-key",
			fetchImpl: fakeStreamingFetch(openAISSE),
			write: (text) => output.push(text),
		});
		expect(output.join("")).toContain("Finish: stop");
	});

	it("LSA-X05: compatible example validates required base URL model and env", async () => {
		await expect(
			runOpenAICompatibleExample({
				apiKey: "key",
				model: "model",
				fetchImpl: fakeStreamingFetch(openAISSE),
			}),
		).rejects.toThrow("OPENAI_COMPATIBLE_BASE_URL is required");
	});

	it("LSA-X06: compatible example uses openaiCompatibleAdapter", async () => {
		const output: string[] = [];
		await runOpenAICompatibleExample({
			baseUrl: "https://example.test/v1",
			apiKey: "key",
			model: "model",
			fetchImpl: fakeStreamingFetch(openAISSE),
			write: (text) => output.push(text),
		});
		expect(output.join("")).toContain("Hello world");
	});

	it("LSA-X07: Anthropic example validates ANTHROPIC_API_KEY", async () => {
		await withEnv({ ANTHROPIC_API_KEY: undefined }, async () => {
			await expect(
				runAnthropicExample({ fetchImpl: fakeStreamingFetch(anthropicSSE) }),
			).rejects.toThrow("ANTHROPIC_API_KEY is required");
		});
	});

	it("LSA-X08: Anthropic example uses injected fake fetch", async () => {
		const output: string[] = [];
		await runAnthropicExample({
			apiKey: "key",
			fetchImpl: fakeStreamingFetch(anthropicSSE),
			write: (text) => output.push(text),
		});
		expect(output.join("")).toContain("Hello Claude");
	});

	it("LSA-X11: Gemini example exports function and does not run on import", () => {
		expect(typeof runGeminiExample).toBe("function");
	});

	it("LSA-X12: Gemini example validates keys and uses injected fake fetch", async () => {
		await withEnv({ GOOGLE_API_KEY: undefined, GEMINI_API_KEY: undefined }, async () => {
			await expect(runGeminiExample({ fetchImpl: fakeStreamingFetch(geminiSSE) })).rejects.toThrow(
				"GOOGLE_API_KEY or GEMINI_API_KEY is required",
			);
		});
		const output: string[] = [];
		await runGeminiExample({
			apiKey: "key",
			fetchImpl: fakeStreamingFetch(geminiSSE),
			write: (text) => output.push(text),
		});
		expect(output.join("")).toContain("Hello Gemini");
	});

	it("LSA-X09: replay fixture example uses assembleFromFile and collectStream", async () => {
		const output: string[] = [];
		await runReplayFixtureExample({
			path: join(rootDir, "test/fixtures/openai-chat/text-basic.sse"),
			write: (text) => output.push(text),
		});
		expect(output.join("")).toContain("Hello world");
	});

	it("LSA-X10: examples do not require live provider network access in tests", async () => {
		let called = false;
		await runOpenAIChatExample({
			apiKey: "test-key",
			fetchImpl: (async () => {
				called = true;
				return new Response(openAISSE);
			}) as typeof fetch,
			write: () => undefined,
		});
		expect(called).toBe(true);
	});

	it("LSA-X10b: examples do not read env vars at module import time", async () => {
		await expect(import("../../examples/node-fetch/openai-chat")).resolves.toBeDefined();
	});

	it("LSA-X10c: write callback captures output without stdout", async () => {
		const output: string[] = [];
		await runOpenAIChatExample({
			apiKey: "test-key",
			fetchImpl: fakeStreamingFetch(openAISSE),
			write: (text) => output.push(text),
		});
		expect(output.length).toBeGreaterThan(0);
	});

	it("LSA-X13: Perplexity example validates PERPLEXITY_API_KEY and uses injected fetch", async () => {
		await withEnv({ PERPLEXITY_API_KEY: undefined }, async () => {
			await expect(
				runPerplexityExample({ fetchImpl: fakeStreamingFetch(perplexitySSE) }),
			).rejects.toThrow("PERPLEXITY_API_KEY is required");
		});
		const output: string[] = [];
		await runPerplexityExample({
			apiKey: "key",
			fetchImpl: fakeStreamingFetch(perplexitySSE),
			write: (text) => output.push(text),
		});
		expect(output.join("")).toContain("Answer from search");
	});

	it("LSA-X14: xAI example validates XAI_API_KEY and uses injected fetch", async () => {
		await withEnv({ XAI_API_KEY: undefined }, async () => {
			await expect(runXaiExample({ fetchImpl: fakeStreamingFetch(xaiSSE) })).rejects.toThrow(
				"XAI_API_KEY is required",
			);
		});
		const output: string[] = [];
		await runXaiExample({
			apiKey: "key",
			fetchImpl: fakeStreamingFetch(xaiSSE),
			write: (text) => output.push(text),
		});
		expect(output.join("")).toContain("Grok says hi");
	});

	it("LSA-X34: Azure OpenAI example validates env and uses injected fake fetch", async () => {
		await withEnv(
			{
				AZURE_OPENAI_API_KEY: undefined,
				AZURE_OPENAI_RESOURCE: undefined,
				AZURE_OPENAI_DEPLOYMENT: undefined,
			},
			async () => {
				await expect(
					runAzureOpenAIExample({ fetchImpl: fakeStreamingFetch(azureSSE) }),
				).rejects.toThrow("AZURE_OPENAI_API_KEY is required");
			},
		);
		const output: string[] = [];
		await runAzureOpenAIExample({
			apiKey: "key",
			resource: "my-resource",
			deployment: "gpt-4o-deployment",
			fetchImpl: fakeStreamingFetch(azureSSE),
			write: (text) => output.push(text),
		});
		expect(output.join("")).toContain("Hello from Azure");
	});
});
