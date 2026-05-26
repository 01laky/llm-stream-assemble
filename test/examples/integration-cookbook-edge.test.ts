import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { dirname, join } from "node:path";
import { PassThrough } from "node:stream";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runAssemblyTransformPipelineExample } from "../../examples/integrations/assembly-transform-pipeline";
import { handleWorkerLLMProxy } from "../../examples/integrations/cloudflare-worker-proxy";
import { runCollectStreamHandlerExample } from "../../examples/integrations/collect-stream-handler";
import { createExpressProxyHandler } from "../../examples/integrations/express-proxy";
import { handleHonoLLMProxy } from "../../examples/integrations/hono-proxy";
import { createLangChainHandlerAdapter } from "../../examples/integrations/langchain-callback-pattern";
import {
	resolveLiteLLMBaseUrl,
	runLiteLLMCompatibleExample,
} from "../../examples/integrations/litellm-openai-compatible";
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

function invalidJsonRequest(): Request {
	return new Request("https://example.test/proxy", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: "{not-json",
	});
}

function mockIncomingRequest(body: string): IncomingMessage {
	const stream = new PassThrough();
	stream.end(body);
	const req = stream as unknown as IncomingMessage;
	req.method = "POST";
	req.url = "/proxy";
	req.headers = { host: "localhost", "content-type": "application/json" };
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

describe("integration cookbook edge cases", () => {
	it("LSA-INT21: Worker handler rejects invalid JSON with 400", async () => {
		const response = await handleWorkerLLMProxy(
			invalidJsonRequest(),
			{ OPENAI_API_KEY: "key" },
			{ fetchImpl: fakeStreamingFetch(openAISSE) },
		);
		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ error: "Request body must be JSON." });
	});

	it("LSA-INT22: Worker handler requires messages or prompt", async () => {
		const response = await handleWorkerLLMProxy(
			proxyRequest({ stream: true }),
			{ OPENAI_API_KEY: "key" },
			{ fetchImpl: fakeStreamingFetch(openAISSE) },
		);
		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({
			error: "Request body must include messages or prompt.",
		});
	});

	it("LSA-INT23: Worker handler returns safe error when OPENAI_API_KEY missing", async () => {
		const response = await handleWorkerLLMProxy(
			proxyRequest({ prompt: "hi" }),
			{},
			{ fetchImpl: fakeStreamingFetch(openAISSE) },
		);
		expect(response.status).toBe(500);
		expect(await response.json()).toEqual({ error: "Worker proxy is not configured." });
	});

	it("LSA-INT24: Worker cloudflare provider path streams with injected fetch", async () => {
		const response = await handleWorkerLLMProxy(
			proxyRequest({ prompt: "hi" }),
			{
				LLM_PROVIDER: "cloudflare",
				CLOUDFLARE_API_TOKEN: "token",
				CLOUDFLARE_ACCOUNT_ID: "acc123",
			},
			{ fetchImpl: fakeStreamingFetch(openAISSE) },
		);
		const events = parseUnifiedSSE(await readResponseText(response));
		expect(events).toContainEqual({ type: "text.delta", text: "Hello" });
	});

	it("LSA-INT25: Worker handler sanitizes provider-error fixture in SSE output", async () => {
		const response = await handleWorkerLLMProxy(
			proxyRequest({ prompt: "hi" }),
			{ OPENAI_API_KEY: "key" },
			{ fetchImpl: fakeStreamingFetch(providerErrorSSE) },
		);
		const text = await readResponseText(response);
		expect(text).toContain("An error occurred while processing the stream.");
		expect(text).not.toContain("rate limit");
	});

	it("LSA-INT26: Worker handler passes request AbortSignal to upstream fetch", async () => {
		const controller = new AbortController();
		const request = new Request("https://example.test/proxy", {
			method: "POST",
			body: JSON.stringify({ prompt: "hi" }),
			signal: controller.signal,
		});
		let signalSeen = false;
		await handleWorkerLLMProxy(
			request,
			{ OPENAI_API_KEY: "key" },
			{
				fetchImpl: (async (_input, init) => {
					signalSeen = init?.signal === request.signal;
					return new Response(openAISSE);
				}) as typeof fetch,
			},
		);
		expect(signalSeen).toBe(true);
	});

	it("LSA-INT27: LiteLLM example throws when LITELLM_API_KEY missing", async () => {
		await withEnv(
			{
				LITELLM_BASE_URL: "http://localhost:4000/v1",
				LITELLM_API_KEY: undefined,
				OPENAI_COMPATIBLE_API_KEY: undefined,
			},
			async () => {
				await expect(
					runLiteLLMCompatibleExample({
						model: "model",
						fetchImpl: fakeStreamingFetch(openAISSE),
					}),
				).rejects.toThrow("LITELLM_API_KEY is required");
			},
		);
	});

	it("LSA-INT28: LiteLLM resolveLiteLLMBaseUrl falls back to OPENAI_COMPATIBLE_BASE_URL", async () => {
		await withEnv(
			{
				LITELLM_BASE_URL: undefined,
				OPENAI_COMPATIBLE_BASE_URL: "http://proxy.test/v1",
			},
			() => {
				expect(resolveLiteLLMBaseUrl()).toBe("http://proxy.test/v1");
			},
		);
	});

	it("LSA-INT29: mapStreamEventToAISDKPart maps finish event", () => {
		expect(mapStreamEventToAISDKPart({ type: "finish", reason: "stop" })).toEqual({
			type: "finish",
			finishReason: "stop",
		});
	});

	it("LSA-INT30: mapStreamEventToAISDKPart returns null for unmapped event kinds", () => {
		expect(mapStreamEventToAISDKPart({ type: "reasoning.delta", text: "thinking" })).toBeNull();
		expect(mapStreamEventToAISDKPart({ type: "message.start", id: "msg_1" })).toBeNull();
	});

	it("LSA-INT31: mapStreamEventToAISDKPart uses default error message without sanitized field", () => {
		expect(
			mapStreamEventToAISDKPart({
				type: "error",
				error: new Error("secret provider blob"),
			}),
		).toEqual({
			type: "error",
			message: "An error occurred while processing the stream.",
		});
	});

	it("LSA-INT32: LangChain adapter accumulates tool_call.args.delta into handleToolStart input", async () => {
		const inputs: string[] = [];
		const adapter = createLangChainHandlerAdapter({
			handleToolStart: (tool) => {
				inputs.push(tool.input);
			},
		});
		await adapter({ type: "tool_call.start", id: "call_1", name: "search", index: 0 });
		await adapter({ type: "tool_call.args.delta", id: "call_1", delta: '{"q":' });
		await adapter({ type: "tool_call.args.delta", id: "call_1", delta: '"x"}' });
		expect(inputs).toEqual(["", '{"q":', '{"q":"x"}']);
	});

	it("LSA-INT33: Hono proxy sets Cache-Control no-cache", async () => {
		const response = await handleHonoLLMProxy(proxyRequest({ prompt: "hi" }), {
			apiKey: "key",
			fetchImpl: fakeStreamingFetch(openAISSE),
		});
		expect(response.headers.get("Cache-Control")).toBe("no-cache");
	});

	it("LSA-INT34: Express handler sanitizes upstream non-OK response", async () => {
		const handler = createExpressProxyHandler({
			apiKey: "key",
			fetchImpl: fakeStreamingFetch("", { ok: false, status: 500, body: "secret upstream body" }),
		});
		const req = mockIncomingRequest(JSON.stringify({ prompt: "hi", stream: true }));
		const res = mockServerResponse();
		await handler(req, res);
		expect(res.statusCode).toBe(502);
		const text = Buffer.concat(res.chunks).toString("utf8");
		expect(text).toContain("Upstream LLM request failed.");
		expect(text).not.toContain("secret upstream body");
	});

	it("LSA-INT35: collectStream handler materializes finish reason from text-basic fixture", async () => {
		const collected = await runCollectStreamHandlerExample();
		expect(collected.text).toBe("Hello world");
		expect(collected.finishReason).toBe("stop");
	});

	it("LSA-INT36: assembly transform pipeline sanitizes provider-error fixture", async () => {
		const response = await runAssemblyTransformPipelineExample({
			apiKey: "key",
			fetchImpl: fakeStreamingFetch(providerErrorSSE),
		});
		const text = await response.text();
		expect(text).toContain("An error occurred while processing the stream.");
		expect(text).not.toContain("rate limit");
	});

	it("LSA-INT37: replay mapper maps tool-single fixture to tool-call part", async () => {
		const parts = await mapFixtureEventsToAISDKParts({
			fixturePath: "test/fixtures/openai-chat/tool-single.sse",
		});
		expect(parts).toContainEqual({
			type: "tool-call",
			toolCallId: "call_search",
			toolName: "search",
			args: { query: "llm stream" },
		});
	});

	it("LSA-INT38: Next.js route handler returns safe error when API key missing", async () => {
		const previous = process.env.OPENAI_API_KEY;
		delete process.env.OPENAI_API_KEY;
		try {
			const response = await handleNextAppRoutePost(proxyRequest({ prompt: "hi" }), {
				fetchImpl: fakeStreamingFetch(openAISSE),
			});
			expect(response.status).toBe(500);
			expect(await response.text()).toContain("LLM proxy is not configured.");
		} finally {
			if (previous === undefined) delete process.env.OPENAI_API_KEY;
			else process.env.OPENAI_API_KEY = previous;
		}
	});
});
