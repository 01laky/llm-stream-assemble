import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { readUnifiedSSE } from "../../examples/proxy-safety/browser-client";
import { sanitizedErrorSSEExample } from "../../examples/proxy-safety/sanitize-errors";
import {
	handleLLMProxyRequest,
	redactEventForLog,
} from "../../examples/proxy-safety/web-standard-proxy";
import { fakeStreamingFetch, parseUnifiedSSE, readResponseText } from "./helpers";

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

describe("proxy safety examples", () => {
	it("LSA-X11: proxy handler returns text/event-stream response", async () => {
		const response = await handleLLMProxyRequest(proxyRequest({ prompt: "hi" }), {
			apiKey: "key",
			fetchImpl: fakeStreamingFetch(openAISSE),
		});
		expect(response.headers.get("Content-Type")).toBe("text/event-stream");
	});

	it("LSA-X12: proxy handler forwards unified SSE events", async () => {
		const response = await handleLLMProxyRequest(proxyRequest({ prompt: "hi" }), {
			apiKey: "key",
			fetchImpl: fakeStreamingFetch(openAISSE),
		});
		const events = parseUnifiedSSE(await readResponseText(response));
		expect(events).toContainEqual({ type: "text.delta", text: "Hello" });
	});

	it("LSA-X13: provider error is sanitized in browser response", async () => {
		const response = await handleLLMProxyRequest(proxyRequest({ prompt: "hi" }), {
			apiKey: "key",
			fetchImpl: fakeStreamingFetch(providerErrorSSE),
		});
		const text = await readResponseText(response);
		expect(text).toContain("An error occurred while processing the stream.");
		expect(text).not.toContain("rate limit");
	});

	it("LSA-X14: provider error raw message is available only to tap log path", async () => {
		const logs: unknown[] = [];
		const response = await handleLLMProxyRequest(proxyRequest({ prompt: "hi" }), {
			apiKey: "key",
			fetchImpl: fakeStreamingFetch(providerErrorSSE),
			logEvent: (event) => logs.push(event),
			redactLogEvent: (event) => event,
		});
		await response.text();
		expect((logs[0] as { error: Error }).error.message).toContain("rate limit");
	});

	it("LSA-X15: SSE response does not include stack traces", async () => {
		const text = await sanitizedErrorSSEExample();
		expect(text).not.toContain("stack");
	});

	it("LSA-X16: AbortSignal from request is passed to upstream fetch", async () => {
		const controller = new AbortController();
		let signalSeen = false;
		const request = new Request("https://example.test/proxy", {
			method: "POST",
			body: JSON.stringify({ prompt: "hi" }),
			signal: controller.signal,
		});
		await handleLLMProxyRequest(request, {
			apiKey: "key",
			fetchImpl: (async (_input, init) => {
				signalSeen = init?.signal === request.signal;
				return new Response(openAISSE);
			}) as typeof fetch,
		});
		expect(signalSeen).toBe(true);
	});

	it("LSA-X17: upstream non-OK response maps to sanitized error response", async () => {
		const response = await handleLLMProxyRequest(proxyRequest({ prompt: "hi" }), {
			apiKey: "key",
			fetchImpl: fakeStreamingFetch("", { ok: false, status: 500, body: "secret upstream body" }),
		});
		expect(response.status).toBe(502);
		const text = await response.text();
		expect(text).toContain("Upstream LLM request failed.");
		expect(text).not.toContain("secret upstream body");
	});

	it("LSA-X18: missing upstream API key returns safe client error", async () => {
		const response = await handleLLMProxyRequest(proxyRequest({ prompt: "hi" }), {
			fetchImpl: fakeStreamingFetch(openAISSE),
		});
		expect(response.status).toBe(500);
		expect(await response.text()).toContain("LLM proxy is not configured.");
	});

	it("LSA-X19: Cache-Control no-cache header is set", async () => {
		const response = await handleLLMProxyRequest(proxyRequest({ prompt: "hi" }), {
			apiKey: "key",
			fetchImpl: fakeStreamingFetch(openAISSE),
		});
		expect(response.headers.get("Cache-Control")).toBe("no-cache");
	});

	it("LSA-X20: toSSE output remains data-only unified event SSE", async () => {
		const response = await handleLLMProxyRequest(proxyRequest({ prompt: "hi" }), {
			apiKey: "key",
			fetchImpl: fakeStreamingFetch(openAISSE),
		});
		const text = await response.text();
		expect(text).toContain("data:");
		expect(text).not.toContain("event:");
	});

	it("LSA-X20b: proxy example does not set non-portable Connection header", async () => {
		const response = await handleLLMProxyRequest(proxyRequest({ prompt: "hi" }), {
			apiKey: "key",
			fetchImpl: fakeStreamingFetch(openAISSE),
		});
		expect(response.headers.has("Connection")).toBe(false);
	});

	it("LSA-X20c: upstream non-OK body is not forwarded raw to browser", async () => {
		const response = await handleLLMProxyRequest(proxyRequest({ prompt: "hi" }), {
			apiKey: "key",
			fetchImpl: fakeStreamingFetch("", { ok: false, body: "sk-secret" }),
		});
		expect(await response.text()).not.toContain("sk-secret");
	});

	it("LSA-X20d: proxy validates request body and rejects missing prompt/messages safely", async () => {
		const response = await handleLLMProxyRequest(proxyRequest({ model: "x" }), { apiKey: "key" });
		expect(response.status).toBe(400);
		expect(await response.text()).toContain("messages or prompt");
	});

	it("LSA-X20e: proxy constructs upstream body from known fields only", async () => {
		let body = "";
		await handleLLMProxyRequest(proxyRequest({ prompt: "hi", secret: "do-not-forward" }), {
			apiKey: "key",
			fetchImpl: (async (_input, init) => {
				body = String(init?.body);
				return new Response(openAISSE);
			}) as typeof fetch,
		});
		expect(body).toContain("hi");
		expect(body).not.toContain("do-not-forward");
	});

	it("LSA-X20f: proxy log path redacts bearer/API-key-like secrets", () => {
		const redacted = redactEventForLog({
			type: "error",
			error: new Error("Bearer sk-abcdefghijklmnopqrstuvwxyz1234567890"),
		});
		expect(JSON.stringify(redacted)).not.toContain("abcdefghijklmnopqrstuvwxyz1234567890");
	});

	it("LSA-X20g: proxy docs mention CORS headers are app-specific", () => {
		const readme = readFileSync(join(rootDir, "examples/proxy-safety/README.md"), "utf8");
		expect(readme).toContain("CORS headers are app-specific");
	});

	it("LSA-X32: browser client snippet parses data-only unified SSE", async () => {
		const seen: unknown[] = [];
		await readUnifiedSSE(new Response('data: {"type":"finish","reason":"stop"}\n\n'), (event) =>
			seen.push(event),
		);
		expect(seen).toEqual([{ type: "finish", reason: "stop" }]);
	});

	it("LSA-X33: browser client snippet does not expect named event fields", async () => {
		const seen: unknown[] = [];
		await readUnifiedSSE(
			new Response('event: finish\ndata: {"type":"finish","reason":"stop"}\n\n'),
			(event) => seen.push(event),
		);
		expect(seen).toEqual([{ type: "finish", reason: "stop" }]);
	});
});
