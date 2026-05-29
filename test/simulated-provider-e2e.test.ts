import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { PassThrough } from "node:stream";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runAnthropicExample } from "../examples/node-fetch/anthropic";
import { runBedrockExample } from "../examples/node-fetch/bedrock";
import { runCohereExample } from "../examples/node-fetch/cohere";
import { runGeminiExample } from "../examples/node-fetch/gemini";
import { runOpenAIChatExample } from "../examples/node-fetch/openai-chat";
import { runOpenAICompatibleExample } from "../examples/node-fetch/openai-compatible";
import { createExpressProxyHandler } from "../examples/integrations/express-proxy";
import { handleHonoLLMProxy } from "../examples/integrations/hono-proxy";
import { bedrockJsonlLines } from "./helpers/bedrock-fixtures";
import { cohereJsonlLines } from "./helpers/cohere-fixtures";
import { runSimulatedProviderCall } from "./helpers/simulated-provider";
import { fakeStreamingFetch, parseUnifiedSSE, readResponseText } from "./examples/helpers";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

function fixture(relativePath: string): string {
	return readFileSync(join(rootDir, relativePath), "utf8");
}

function proxyRequest(body: unknown): Request {
	return new Request("https://example.test/proxy", {
		method: "POST",
		body: JSON.stringify(body),
	});
}

function mockIncomingRequest(body: string): IncomingMessage {
	const stream = new PassThrough();
	stream.end(body);
	const req = stream as unknown as IncomingMessage;
	req.method = "POST";
	req.url = "/proxy";
	req.headers = {
		host: "localhost",
		"content-type": "application/json",
	};
	return req;
}

function mockServerResponse(): ServerResponse & {
	headers: Record<string, string | number>;
	chunks: Buffer[];
} {
	const res = new EventEmitter() as ServerResponse & {
		headers: Record<string, string | number>;
		chunks: Buffer[];
	};
	res.headers = {};
	res.chunks = [];
	res.statusCode = 200;
	res.setHeader = (name: string, value: string | number) => {
		res.headers[name.toLowerCase()] = value;
	};
	res.write = (chunk: string | Uint8Array) => {
		res.chunks.push(Buffer.from(chunk));
		return true;
	};
	res.end = (chunk?: string | Uint8Array) => {
		if (chunk !== undefined) res.write(chunk);
		res.emit("finish");
		return res;
	};
	return res;
}

describe("simulated provider e2e", () => {
	const openAISse = fixture("test/fixtures/openai-chat/text-basic.sse");
	const anthropicSse = fixture("test/fixtures/anthropic/text-basic.sse");
	const geminiSse = fixture("test/fixtures/gemini/text-basic.sse");
	const cohereJsonl = fixture("test/fixtures/cohere/text-basic.jsonl");
	const toolSse = fixture("test/fixtures/openai-chat/tool-parallel.sse");

	it("LSA-INT59: runSimulatedProviderCall OpenAI text-basic", async () => {
		const result = await runSimulatedProviderCall({
			fixtureBody: openAISse,
			runExample: runOpenAIChatExample,
		});
		expect(result.status).toBe(200);
		expect(result.output).toContain("Hello world");
	});

	it("LSA-INT60: runSimulatedProviderCall Anthropic text-basic", async () => {
		const result = await runSimulatedProviderCall({
			fixtureBody: anthropicSse,
			runExample: runAnthropicExample,
		});
		expect(result.output).toContain("Hello Claude");
	});

	it("LSA-INT61: runSimulatedProviderCall Gemini text-basic", async () => {
		const result = await runSimulatedProviderCall({
			fixtureBody: geminiSse,
			runExample: runGeminiExample,
		});
		expect(result.output).toContain("Hello Gemini");
	});

	it("LSA-INT62: runSimulatedProviderCall Cohere text-basic sse", async () => {
		const cohereSse = fixture("test/fixtures/cohere/text-basic.sse");
		const result = await runSimulatedProviderCall({
			fixtureBody: cohereSse,
			runExample: runCohereExample,
		});
		expect(result.output).toContain("Hello Cohere");
	});

	it("LSA-INT63: runSimulatedProviderCall OpenAI chunk-1", async () => {
		const result = await runSimulatedProviderCall({
			fixtureBody: openAISse,
			chunkSize: 1,
			runExample: runOpenAIChatExample,
		});
		expect(result.output).toContain("Finish: stop");
	});

	it("LSA-INT64: runSimulatedProviderCall Anthropic chunk-17", async () => {
		const result = await runSimulatedProviderCall({
			fixtureBody: anthropicSse,
			chunkSize: 17,
			runExample: runAnthropicExample,
		});
		expect(result.output).toContain("Finish: stop");
	});

	it("LSA-INT65: runSimulatedProviderCall Gemini chunk-64", async () => {
		const result = await runSimulatedProviderCall({
			fixtureBody: geminiSse,
			chunkSize: 64,
			runExample: runGeminiExample,
		});
		expect(result.output).toContain("Hello Gemini");
	});

	it("LSA-INT66: runSimulatedProviderCall OpenAI tool-parallel", async () => {
		const result = await runSimulatedProviderCall({
			fixtureBody: toolSse,
			runExample: runOpenAIChatExample,
		});
		expect(result.output).toContain("Tool call:");
	});

	it("LSA-INT67: runBedrockExample offline eventLines text-basic", async () => {
		const output: string[] = [];
		await runBedrockExample({
			eventLines: bedrockJsonlLines("text-basic"),
			write: (text) => output.push(text),
		});
		expect(output.join("")).toContain("Hello Bedrock");
	});

	it("LSA-INT68: runCohereExample offline eventLines text-basic", async () => {
		const output: string[] = [];
		await runCohereExample({
			eventLines: cohereJsonlLines("text-basic"),
			write: (text) => output.push(text),
		});
		expect(output.join("")).toContain("Hello Cohere");
	});

	it("LSA-INT69: handleHonoLLMProxy with simulated OpenAI fetch", async () => {
		const response = await handleHonoLLMProxy(proxyRequest({ prompt: "hi" }), {
			apiKey: "key",
			fetchImpl: fakeStreamingFetch(openAISse),
		});
		const events = parseUnifiedSSE(await readResponseText(response));
		expect(events).toContainEqual({ type: "text.delta", text: "Hello" });
	});

	it("LSA-INT70: createExpressProxyHandler streams OpenAI fixture", async () => {
		const handler = createExpressProxyHandler({
			apiKey: "key",
			fetchImpl: fakeStreamingFetch(openAISse),
		});
		const req = mockIncomingRequest(JSON.stringify({ prompt: "hi", stream: true }));
		const res = mockServerResponse();
		await handler(req, res);
		expect(res.headers["content-type"]).toBe("text/event-stream");
		expect(Buffer.concat(res.chunks).toString("utf8")).toContain("text.delta");
	});

	it("LSA-INT71: handleHonoLLMProxy Anthropic fixture", async () => {
		const response = await handleHonoLLMProxy(proxyRequest({ prompt: "hi" }), {
			apiKey: "key",
			fetchImpl: fakeStreamingFetch(anthropicSse),
		});
		expect(response.headers.get("Content-Type")).toBe("text/event-stream");
	});

	it("LSA-INT72: Express proxy OpenAI fixture emits finish stop", async () => {
		const handler = createExpressProxyHandler({
			apiKey: "key",
			fetchImpl: fakeStreamingFetch(openAISse),
		});
		const req = mockIncomingRequest(JSON.stringify({ prompt: "hi", stream: true }));
		const res = mockServerResponse();
		await handler(req, res);
		expect(Buffer.concat(res.chunks).toString("utf8")).toContain('"reason":"stop"');
	});

	it("LSA-INT73: runSimulatedProviderCall cohere chunk-3", async () => {
		const result = await runSimulatedProviderCall({
			fixtureBody: cohereJsonl,
			contentType: "application/x-ndjson",
			chunkSize: 3,
			runExample: runCohereExample,
		});
		expect(result.output).toContain("Finish:");
	});

	it("LSA-INT74: runBedrockExample tool-single offline", async () => {
		const output: string[] = [];
		await runBedrockExample({
			eventLines: bedrockJsonlLines("tool-single"),
			write: (text) => output.push(text),
		});
		expect(output.join("")).toMatch(/Tool:|Finish:/);
	});

	it("LSA-INT75: handleHonoLLMProxy Gemini fixture returns SSE stream", async () => {
		const response = await handleHonoLLMProxy(proxyRequest({ prompt: "hi" }), {
			apiKey: "key",
			fetchImpl: fakeStreamingFetch(geminiSse),
		});
		expect(response.headers.get("Content-Type")).toBe("text/event-stream");
		expect((await readResponseText(response)).length).toBeGreaterThan(0);
	});

	it("LSA-INT76: Express proxy Gemini fixture", async () => {
		const handler = createExpressProxyHandler({
			apiKey: "key",
			fetchImpl: fakeStreamingFetch(geminiSse),
		});
		const req = mockIncomingRequest(JSON.stringify({ prompt: "hi", stream: true }));
		const res = mockServerResponse();
		await handler(req, res);
		expect(Buffer.concat(res.chunks).length).toBeGreaterThan(0);
	});

	it("LSA-INT77: runSimulatedProviderCall OpenAI usage fixture", async () => {
		const usageSse = fixture("test/fixtures/openai-chat/usage.sse");
		const result = await runSimulatedProviderCall({
			fixtureBody: usageSse,
			runExample: runOpenAIChatExample,
		});
		expect(result.output).toContain("Usage:");
	});

	it("LSA-INT78: runSimulatedProviderCall anthropic usage-stream fixture", async () => {
		const usageSse = fixture("test/fixtures/anthropic/usage-stream.sse");
		const result = await runSimulatedProviderCall({
			fixtureBody: usageSse,
			runExample: runAnthropicExample,
		});
		expect(result.output).toContain("Hello usage");
	});

	it("LSA-INT79: runSimulatedProviderCall OpenAI-compatible text-basic", async () => {
		const compatibleSse = fixture("test/fixtures/openai-compatible/groq/text-basic.sse");
		const result = await runSimulatedProviderCall({
			fixtureBody: compatibleSse,
			runExample: ({ fetchImpl, apiKey, write }) =>
				runOpenAICompatibleExample({
					baseUrl: "https://example.test/v1",
					apiKey,
					model: "gpt-4o-mini",
					provider: "generic",
					fetchImpl,
					write,
				}),
		});
		expect(result.output).toContain("Finish:");
	});

	it("LSA-INT80: runSimulatedProviderCall OpenAI-compatible chunk-7", async () => {
		const compatibleSse = fixture("test/fixtures/openai-compatible/groq/text-basic.sse");
		const result = await runSimulatedProviderCall({
			fixtureBody: compatibleSse,
			chunkSize: 7,
			runExample: ({ fetchImpl, apiKey, write }) =>
				runOpenAICompatibleExample({
					baseUrl: "https://example.test/v1",
					apiKey,
					model: "gpt-4o-mini",
					provider: "generic",
					fetchImpl,
					write,
				}),
		});
		expect(result.output).toContain("Finish:");
	});

	it("LSA-INT81: handleHonoLLMProxy openai-compatible provider", async () => {
		const compatibleSse = fixture("test/fixtures/openai-compatible/groq/text-basic.sse");
		const response = await handleHonoLLMProxy(
			proxyRequest({ provider: "openai-compatible", prompt: "hi" }),
			{
				apiKey: "key",
				fetchImpl: fakeStreamingFetch(compatibleSse),
			},
		);
		expect(response.headers.get("Content-Type")).toBe("text/event-stream");
		const events = parseUnifiedSSE(await readResponseText(response));
		expect(events.some((event) => (event as { type?: string }).type === "finish")).toBe(true);
	});

	it("LSA-INT82: Express proxy anthropic provider emits finish", async () => {
		const handler = createExpressProxyHandler({
			apiKey: "key",
			fetchImpl: fakeStreamingFetch(anthropicSse),
		});
		const req = mockIncomingRequest(
			JSON.stringify({ provider: "anthropic", prompt: "hi", stream: true }),
		);
		const res = mockServerResponse();
		await handler(req, res);
		const events = parseUnifiedSSE(Buffer.concat(res.chunks).toString("utf8"));
		expect(events.some((event) => (event as { type?: string }).type === "finish")).toBe(true);
	});

	it("LSA-INT83: runSimulatedProviderCall anthropic tool-parallel fixture", async () => {
		const toolFixture = fixture("test/fixtures/anthropic/tool-parallel.sse");
		const result = await runSimulatedProviderCall({
			fixtureBody: toolFixture,
			runExample: runAnthropicExample,
		});
		expect(result.output).toContain("Tool");
	});

	it("LSA-INT84: runSimulatedProviderCall OpenAI tool-parallel chunk-1", async () => {
		const result = await runSimulatedProviderCall({
			fixtureBody: toolSse,
			chunkSize: 1,
			runExample: runOpenAIChatExample,
		});
		expect(result.output).toContain("Tool call:");
	});
});
