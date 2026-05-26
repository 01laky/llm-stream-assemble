import {
	assembleStream,
	openaiChatAdapter,
	openaiCompatibleAdapter,
	tapEvents,
	toSSE,
	type StreamEvent,
} from "../../src/index";
import { buildCloudflareWorkersAIChatCompletionsUrl } from "../workers-ai/rest-chat-completions";

export interface WorkerProxyEnv {
	OPENAI_API_KEY?: string;
	CLOUDFLARE_API_TOKEN?: string;
	CLOUDFLARE_ACCOUNT_ID?: string;
	CLOUDFLARE_MODEL?: string;
	LLM_PROVIDER?: "openai" | "cloudflare";
}

export interface WorkerProxyOptions {
	fetchImpl?: typeof fetch;
	logEvent?: (event: StreamEvent) => void;
	model?: string;
}

interface WorkerProxyBody {
	messages?: unknown[];
	prompt?: string;
	stream?: boolean;
	model?: string;
}

export async function handleWorkerLLMProxy(
	request: Request,
	env: WorkerProxyEnv,
	options: WorkerProxyOptions = {},
): Promise<Response> {
	const parsed = await parseWorkerProxyBody(request);
	if (!parsed.ok) {
		return jsonError(parsed.error, 400);
	}

	const provider = env.LLM_PROVIDER ?? (env.CLOUDFLARE_API_TOKEN ? "cloudflare" : "openai");
	const fetchImpl = options.fetchImpl ?? fetch;

	let upstreamUrl: string;
	let headers: Record<string, string>;
	let adapter;

	if (provider === "cloudflare") {
		const token = env.CLOUDFLARE_API_TOKEN;
		const accountId = env.CLOUDFLARE_ACCOUNT_ID;
		if (!token) return jsonError("Worker proxy is not configured.", 500);
		if (!accountId) return jsonError("CLOUDFLARE_ACCOUNT_ID is required.", 500);
		upstreamUrl = buildCloudflareWorkersAIChatCompletionsUrl({ accountId });
		headers = {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
		};
		adapter = openaiCompatibleAdapter({ provider: "cloudflare" });
	} else {
		const apiKey = env.OPENAI_API_KEY;
		if (!apiKey) return jsonError("Worker proxy is not configured.", 500);
		upstreamUrl = "https://api.openai.com/v1/chat/completions";
		headers = {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		};
		adapter = openaiChatAdapter();
	}

	const upstreamResponse = await fetchImpl(upstreamUrl, {
		method: "POST",
		headers,
		body: JSON.stringify(upstreamBody(parsed.body, options.model ?? env.CLOUDFLARE_MODEL)),
		signal: request.signal,
	});

	if (!upstreamResponse.ok || !upstreamResponse.body) {
		return jsonError("Upstream LLM request failed.", 502);
	}

	const events = assembleStream(upstreamResponse.body, adapter, { signal: request.signal });
	const tapped = tapEvents(events, (event) => {
		options.logEvent?.(event);
	});

	return new Response(toSSE(tapped, { sanitizeErrors: true }), {
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
		},
	});
}

export interface WorkerProxyExampleOptions extends WorkerProxyOptions {
	apiKey?: string;
	write?: (text: string) => void;
}

export async function runWorkerProxyExample(
	options: WorkerProxyExampleOptions = {},
): Promise<void> {
	const write = options.write ?? ((text: string) => process.stdout.write(text));
	const request = new Request("https://worker.example/proxy", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ prompt: "hi", stream: true }),
	});
	const response = await handleWorkerLLMProxy(
		request,
		{ OPENAI_API_KEY: options.apiKey ?? "test-key" },
		options,
	);
	write(await response.text());
}

async function parseWorkerProxyBody(
	request: Request,
): Promise<{ ok: true; body: WorkerProxyBody } | { ok: false; error: string }> {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return { ok: false, error: "Request body must be JSON." };
	}
	if (!body || typeof body !== "object" || Array.isArray(body)) {
		return { ok: false, error: "Request body must be an object." };
	}
	const record = body as Record<string, unknown>;
	const proxyBody: WorkerProxyBody = {
		messages: Array.isArray(record.messages) ? record.messages : undefined,
		prompt: typeof record.prompt === "string" ? record.prompt : undefined,
		stream: typeof record.stream === "boolean" ? record.stream : undefined,
		model: typeof record.model === "string" ? record.model : undefined,
	};
	if (!proxyBody.messages && !proxyBody.prompt) {
		return { ok: false, error: "Request body must include messages or prompt." };
	}
	return { ok: true, body: proxyBody };
}

function upstreamBody(body: WorkerProxyBody, fallbackModel?: string) {
	const messages = body.messages ?? [{ role: "user", content: body.prompt }];
	return {
		model: body.model ?? fallbackModel ?? "gpt-4o-mini",
		messages,
		stream: body.stream ?? true,
		stream_options: { include_usage: true },
	};
}

function jsonError(message: string, status: number): Response {
	return new Response(JSON.stringify({ error: message }), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}
