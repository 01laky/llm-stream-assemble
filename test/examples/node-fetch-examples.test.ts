import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runAnthropicExample } from "../../examples/node-fetch/anthropic";
import { runAzureOpenAIExample } from "../../examples/node-fetch/azure-openai";
import {
	runCloudflareWorkersAIExample,
	buildCloudflareWorkersAIChatCompletionsUrl,
} from "../../examples/workers-ai/rest-chat-completions";
import { runBedrockExample } from "../../examples/node-fetch/bedrock";
import { runCohereExample } from "../../examples/node-fetch/cohere";
import { runGeminiExample } from "../../examples/node-fetch/gemini";
import { runOpenAIChatExample } from "../../examples/node-fetch/openai-chat";
import { runOpenAICompatibleExample } from "../../examples/node-fetch/openai-compatible";
import { runPerplexityExample } from "../../examples/node-fetch/perplexity";
import { runReplayFixtureExample } from "../../examples/node-fetch/replay-fixture";
import { runXaiExample } from "../../examples/node-fetch/xai";
import { fakeStreamingFetch, withEnv } from "./helpers";
import { bedrockJsonlLines } from "../helpers/bedrock-fixtures";
import { cohereJsonlLines } from "../helpers/cohere-fixtures";

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
const cloudflareSSE = readFileSync(
	join(rootDir, "test/fixtures/openai-compatible/cloudflare/text-basic.sse"),
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

	it("LSA-X36: Cloudflare Workers AI example validates env and uses injected fake fetch", async () => {
		await withEnv(
			{
				CLOUDFLARE_API_TOKEN: undefined,
				CLOUDFLARE_ACCOUNT_ID: undefined,
			},
			async () => {
				await expect(
					runCloudflareWorkersAIExample({ fetchImpl: fakeStreamingFetch(cloudflareSSE) }),
				).rejects.toThrow("CLOUDFLARE_API_TOKEN is required");
			},
		);
		await withEnv(
			{
				CLOUDFLARE_API_TOKEN: "token",
				CLOUDFLARE_ACCOUNT_ID: undefined,
			},
			async () => {
				await expect(
					runCloudflareWorkersAIExample({ fetchImpl: fakeStreamingFetch(cloudflareSSE) }),
				).rejects.toThrow("CLOUDFLARE_ACCOUNT_ID is required");
			},
		);
		const output: string[] = [];
		await runCloudflareWorkersAIExample({
			apiToken: "token",
			accountId: "acct",
			fetchImpl: fakeStreamingFetch(cloudflareSSE),
			write: (text) => output.push(text),
		});
		expect(output.join("")).toContain("Hello from Cloudflare");
	});

	it("LSA-X40: buildCloudflareWorkersAIChatCompletionsUrl embeds account id in path", () => {
		const url = buildCloudflareWorkersAIChatCompletionsUrl({ accountId: "acct_123" });
		expect(url).toBe(
			"https://api.cloudflare.com/client/v4/accounts/acct_123/ai/v1/chat/completions",
		);
	});

	it("LSA-X41: Cloudflare example source documents stream_options include_usage", () => {
		const source = readFileSync(
			join(rootDir, "examples/workers-ai/rest-chat-completions.ts"),
			"utf8",
		);
		expect(source).toContain("stream_options");
		expect(source).toContain("include_usage");
		expect(source).toContain('provider: "cloudflare"');
	});

	it("LSA-X56: Bedrock example runs offline with fixture eventLines", async () => {
		const output: string[] = [];
		await runBedrockExample({
			eventLines: bedrockJsonlLines("text-basic"),
			write: (text) => output.push(text),
		});
		expect(output.join("")).toContain("Hello Bedrock");
	});

	it("LSA-INT42: cohere example runs offline with fixture eventLines", async () => {
		const output: string[] = [];
		await runCohereExample({
			eventLines: cohereJsonlLines("text-basic"),
			write: (text) => output.push(text),
		});
		expect(output.join("")).toContain("Hello Cohere");
	});

	it("LSA-INT43: cohere.ts does not import cohere SDK packages", () => {
		const source = readFileSync(join(rootDir, "examples/node-fetch/cohere.ts"), "utf8");
		expect(source).not.toMatch(/from ["']cohere["']/);
		expect(source).toContain("cohereAdapter");
	});

	it("LSA-INT44: examples README lists cohere node-fetch example", () => {
		expect(readFileSync(join(rootDir, "examples/README.md"), "utf8")).toContain(
			"node-fetch/cohere.ts",
		);
	});

	it("LSA-INT48: vertex-gemini example runs offline with fixture eventLines", async () => {
		const { runVertexGeminiExample } = await import("../../examples/node-fetch/vertex-gemini");
		const { vertexJsonlLines } = await import("../helpers/gemini-fixtures");
		const output: string[] = [];
		await runVertexGeminiExample({
			eventLines: vertexJsonlLines("text-basic"),
			write: (text) => output.push(text),
		});
		expect(output.join("")).toContain("Hello");
	});

	it("LSA-INT49: vertex-gemini.ts does not import @google-cloud packages", () => {
		const source = readFileSync(join(rootDir, "examples/node-fetch/vertex-gemini.ts"), "utf8");
		expect(source).not.toContain("@google-cloud/");
		expect(source).toContain('apiSurface: "vertex"');
	});

	it("LSA-INT50: examples README lists vertex-gemini node-fetch example", () => {
		expect(readFileSync(join(rootDir, "examples/README.md"), "utf8")).toContain(
			"node-fetch/vertex-gemini.ts",
		);
	});
});
