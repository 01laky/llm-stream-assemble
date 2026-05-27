import { EventEmitter } from "node:events";
import { readFileSync, readdirSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { PassThrough } from "node:stream";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runAssemblyTransformExample } from "../../examples/integrations/assembly-transform-pipeline";
import { handleWorkerLLMProxy } from "../../examples/integrations/cloudflare-worker-proxy";
import { runCollectStreamHandlerExample } from "../../examples/integrations/collect-stream-handler";
import { createExpressProxyHandler } from "../../examples/integrations/express-proxy";
import { handleHonoLLMProxy } from "../../examples/integrations/hono-proxy";
import {
	createLangChainHandlerAdapter,
	runLangChainCallbackExample,
} from "../../examples/integrations/langchain-callback-pattern";
import { runLiteLLMCompatibleExample } from "../../examples/integrations/litellm-openai-compatible";
import { handleNextAppRoutePost } from "../../examples/integrations/nextjs-app-route";
import { mapFixtureEventsToAISDKParts } from "../../examples/integrations/replay-integration-mapper";
import { mapStreamEventToAISDKPart } from "../../examples/integrations/stream-event-to-ai-sdk-parts";
import { fakeStreamingFetch, parseUnifiedSSE, readResponseText, withEnv } from "./helpers";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "../..");
const openAISSE = readFileSync(join(rootDir, "test/fixtures/openai-chat/text-basic.sse"), "utf8");
const providerErrorSSE = readFileSync(
	join(rootDir, "test/fixtures/openai-chat/provider-error.sse"),
	"utf8",
);

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

describe("integration cookbook examples", () => {
	it("LSA-INT01: handleHonoLLMProxy returns text/event-stream", async () => {
		const response = await handleHonoLLMProxy(proxyRequest({ prompt: "hi" }), {
			apiKey: "key",
			fetchImpl: fakeStreamingFetch(openAISSE),
		});
		expect(response.headers.get("Content-Type")).toBe("text/event-stream");
	});

	it("LSA-INT02: Hono handler forwards text.delta Hello from text-basic fixture", async () => {
		const response = await handleHonoLLMProxy(proxyRequest({ prompt: "hi" }), {
			apiKey: "key",
			fetchImpl: fakeStreamingFetch(openAISSE),
		});
		const events = parseUnifiedSSE(await readResponseText(response));
		expect(events).toContainEqual({ type: "text.delta", text: "Hello" });
	});

	it("LSA-INT03: Express handler sets SSE content-type on mock response", async () => {
		const handler = createExpressProxyHandler({
			apiKey: "key",
			fetchImpl: fakeStreamingFetch(openAISSE),
		});
		const req = mockIncomingRequest(JSON.stringify({ prompt: "hi", stream: true }));
		const res = mockServerResponse();
		await handler(req, res);
		expect(res.headers["content-type"]).toBe("text/event-stream");
	});

	it("LSA-INT04: Express handler sanitizes provider-error fixture", async () => {
		const handler = createExpressProxyHandler({
			apiKey: "key",
			fetchImpl: fakeStreamingFetch(providerErrorSSE),
		});
		const req = mockIncomingRequest(JSON.stringify({ prompt: "hi", stream: true }));
		const res = mockServerResponse();
		await handler(req, res);
		const text = Buffer.concat(res.chunks).toString("utf8");
		expect(text).toContain("An error occurred while processing the stream.");
		expect(text).not.toContain("rate limit");
	});

	it("LSA-INT05: Worker handler returns unified SSE with injected fetch", async () => {
		const response = await handleWorkerLLMProxy(
			proxyRequest({ prompt: "hi" }),
			{ OPENAI_API_KEY: "key" },
			{ fetchImpl: fakeStreamingFetch(openAISSE) },
		);
		const events = parseUnifiedSSE(await readResponseText(response));
		expect(events).toContainEqual({ type: "text.delta", text: "Hello" });
	});

	it("LSA-INT06: cloudflare-worker-proxy.ts does not import node:fs or assembleFromFile", () => {
		const source = readFileSync(
			join(rootDir, "examples/integrations/cloudflare-worker-proxy.ts"),
			"utf8",
		);
		expect(source).not.toContain("node:fs");
		expect(source).not.toContain("assembleFromFile");
	});

	it("LSA-INT07: LiteLLM example throws when LITELLM_BASE_URL missing", async () => {
		await withEnv(
			{
				LITELLM_BASE_URL: undefined,
				OPENAI_COMPATIBLE_BASE_URL: undefined,
			},
			async () => {
				await expect(
					runLiteLLMCompatibleExample({
						apiKey: "key",
						model: "model",
						fetchImpl: fakeStreamingFetch(openAISSE),
					}),
				).rejects.toThrow("LITELLM_BASE_URL is required");
			},
		);
	});

	it("LSA-INT08: LiteLLM example streams fixture text with fake fetch", async () => {
		const output: string[] = [];
		await runLiteLLMCompatibleExample({
			baseUrl: "http://localhost:4000/v1",
			apiKey: "key",
			model: "model",
			fetchImpl: fakeStreamingFetch(openAISSE),
			write: (text) => output.push(text),
		});
		expect(output.join("")).toContain("Hello world");
	});

	it("LSA-INT09: mapStreamEventToAISDKPart maps text.delta", () => {
		expect(mapStreamEventToAISDKPart({ type: "text.delta", text: "Hi" })).toEqual({
			type: "text-delta",
			textDelta: "Hi",
		});
	});

	it("LSA-INT10: mapStreamEventToAISDKPart maps tool_call.done", () => {
		expect(
			mapStreamEventToAISDKPart({
				type: "tool_call.done",
				id: "call_1",
				name: "search",
				args: { q: "weather" },
			}),
		).toEqual({
			type: "tool-call",
			toolCallId: "call_1",
			toolName: "search",
			args: { q: "weather" },
		});
	});

	it("LSA-INT11: AI SDK mapper uses sanitized error message", () => {
		expect(
			mapStreamEventToAISDKPart({
				type: "error",
				error: new Error("rate limit exceeded"),
				sanitized: "Safe client message",
			}),
		).toEqual({
			type: "error",
			message: "Safe client message",
		});
	});

	it("LSA-INT12: LangChain adapter invokes handleLLMNewToken on text deltas", async () => {
		const tokens: string[] = [];
		const adapter = createLangChainHandlerAdapter({
			handleLLMNewToken: (token) => {
				tokens.push(token);
			},
		});
		await adapter({ type: "text.delta", text: "Hi" });
		expect(tokens).toEqual(["Hi"]);
	});

	it("LSA-INT13: LangChain adapter maps tool_call.start and tool_call.done", async () => {
		const starts: string[] = [];
		const ends: string[] = [];
		await runLangChainCallbackExample({
			handlers: {
				handleToolStart: (tool) => starts.push(tool.name),
				handleToolEnd: (output) => ends.push(output),
			},
		});
		expect(starts).toContain("get_weather");
		expect(ends).toEqual(["{}"]);
	});

	it("LSA-INT14: integration modules export run* helpers and import safely", async () => {
		const modules = [
			"../../examples/integrations/hono-proxy",
			"../../examples/integrations/express-proxy",
			"../../examples/integrations/cloudflare-worker-proxy",
			"../../examples/integrations/litellm-openai-compatible",
			"../../examples/integrations/stream-event-to-ai-sdk-parts",
			"../../examples/integrations/langchain-callback-pattern",
			"../../examples/integrations/collect-stream-handler",
			"../../examples/integrations/assembly-transform-pipeline",
			"../../examples/integrations/nextjs-app-route",
			"../../examples/integrations/replay-integration-mapper",
		];
		for (const path of modules) {
			const mod = (await import(path)) as Record<string, unknown>;
			expect(Object.keys(mod).some((key) => key.startsWith("run"))).toBe(true);
		}
	});

	it("LSA-INT15: examples/integrations/README links to docs/integration-cookbook.md", () => {
		expect(readFileSync(join(rootDir, "examples/integrations/README.md"), "utf8")).toContain(
			"docs/integration-cookbook.md",
		);
	});

	it("LSA-INT16: integration-cookbook.md mentions core integration files by path", () => {
		const doc = readFileSync(join(rootDir, "docs/integration-cookbook.md"), "utf8");
		for (const file of [
			"hono-proxy.ts",
			"express-proxy.ts",
			"cloudflare-worker-proxy.ts",
			"bedrock-worker-proxy.ts",
			"cohere-proxy.ts",
			"litellm-openai-compatible.ts",
			"stream-event-to-ai-sdk-parts.ts",
			"langchain-callback-pattern.ts",
			"collect-stream-handler.ts",
			"assembly-transform-pipeline.ts",
			"nextjs-app-route.ts",
			"replay-integration-mapper.ts",
		]) {
			expect(doc).toContain(file);
		}
	});

	it("LSA-INT17: integration sources import from ../../src/ not provider SDKs", () => {
		const files = readdirSync(join(rootDir, "examples/integrations")).filter((name) =>
			name.endsWith(".ts"),
		);
		const combined = files
			.map((name) => readFileSync(join(rootDir, "examples/integrations", name), "utf8"))
			.join("\n");
		expect(combined).toContain("../../src/");
		expect(combined).not.toContain('from "llm-stream-assemble"');
		expect(combined).not.toContain('from "hono"');
		expect(combined).not.toContain('from "@ai-sdk/');
	});

	it("LSA-INT18: litellm example uses openaiCompatibleAdapter generic provider", () => {
		const source = readFileSync(
			join(rootDir, "examples/integrations/litellm-openai-compatible.ts"),
			"utf8",
		);
		expect(source).toContain('openaiCompatibleAdapter({ provider: "generic" })');
	});

	it("LSA-INT19: replay integration mapper snapshot includes text-delta part", async () => {
		const parts = await mapFixtureEventsToAISDKParts();
		expect(parts).toContainEqual({ type: "text-delta", textDelta: "Hello" });
		expect(parts).toContainEqual({ type: "text-delta", textDelta: " world" });
	});

	it("LSA-INT20: collectStream handler and assembly transform pipeline run offline", async () => {
		const collected = await runCollectStreamHandlerExample();
		expect(collected.text).toBe("Hello world");

		const output: string[] = [];
		await runAssemblyTransformExample({
			apiKey: "key",
			fetchImpl: fakeStreamingFetch(openAISSE),
			write: (text) => output.push(text),
		});
		expect(output.join("")).toContain("Hello");

		const next = await handleNextAppRoutePost(proxyRequest({ prompt: "hi" }), {
			apiKey: "key",
			fetchImpl: fakeStreamingFetch(openAISSE),
		});
		expect(next.headers.get("Content-Type")).toBe("text/event-stream");
	});

	it("LSA-INT39: handleBedrockWorkerProxy returns text/event-stream with fixture bytes", async () => {
		const { handleBedrockWorkerProxy } =
			await import("../../examples/integrations/bedrock-worker-proxy");
		const { readFileSync } = await import("node:fs");
		const bytes = new Uint8Array(
			readFileSync(join(rootDir, "test/fixtures/bedrock/event-stream-bytes.bin")),
		);
		const response = await handleBedrockWorkerProxy(
			proxyRequest({ prompt: "hi", stream: true }),
			{ AWS_REGION: "us-east-1", BEDROCK_MODEL_ID: "test-model" },
			{
				fetchImpl: async () =>
					new Response(bytes, {
						status: 200,
						headers: { "Content-Type": "application/vnd.amazon.eventstream" },
					}),
			},
		);
		expect(response.headers.get("Content-Type")).toBe("text/event-stream");
		const body = await response.text();
		expect(body).toContain("data:");
	});

	it("LSA-INT40: bedrock-worker-proxy.ts does not import node:fs or @aws-sdk/*", () => {
		const source = readFileSync(
			join(rootDir, "examples/integrations/bedrock-worker-proxy.ts"),
			"utf8",
		);
		expect(source).not.toMatch(/from ["']node:fs["']/);
		expect(source).not.toContain("@aws-sdk/");
	});

	it("LSA-INT41: examples/integrations/README.md lists bedrock-worker-proxy.ts", () => {
		expect(readFileSync(join(rootDir, "examples/integrations/README.md"), "utf8")).toContain(
			"bedrock-worker-proxy.ts",
		);
	});

	it("LSA-INT45: handleCohereWorkerProxy returns text/event-stream with fixture sse", async () => {
		const { handleCohereWorkerProxy } = await import("../../examples/integrations/cohere-proxy");
		const sse = readFileSync(join(rootDir, "test/fixtures/cohere/text-basic.sse"), "utf8");
		const response = await handleCohereWorkerProxy(
			proxyRequest({ prompt: "hi", stream: true }),
			{ COHERE_API_KEY: "test-key", COHERE_MODEL: "command-r-plus-08-2024" },
			{
				fetchImpl: async () =>
					new Response(sse, {
						status: 200,
						headers: { "Content-Type": "text/event-stream" },
					}),
			},
		);
		expect(response.headers.get("Content-Type")).toBe("text/event-stream");
		const body = await response.text();
		expect(body).toContain("data:");
	});

	it("LSA-INT46: cohere-proxy.ts does not import cohere SDK packages", () => {
		const source = readFileSync(join(rootDir, "examples/integrations/cohere-proxy.ts"), "utf8");
		expect(source).not.toMatch(/from ["']cohere["']/);
		expect(source).toContain("cohereAdapter");
	});

	it("LSA-INT47: examples/integrations/README.md lists cohere-proxy.ts", () => {
		expect(readFileSync(join(rootDir, "examples/integrations/README.md"), "utf8")).toContain(
			"cohere-proxy.ts",
		);
	});

	it("LSA-INT51: integration-cookbook.md references vertex-gemini.ts and read-chunk-stream", () => {
		const doc = readFileSync(join(rootDir, "docs/integration-cookbook.md"), "utf8");
		expect(doc).toContain("vertex-gemini.ts");
		expect(doc).toContain("read-chunk-stream");
	});
});
