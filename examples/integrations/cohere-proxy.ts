import { assembleStream, cohereAdapter, tapEvents, toSSE, type StreamEvent } from "../../src/index";

export interface CohereWorkerProxyEnv {
	COHERE_API_KEY?: string;
	COHERE_MODEL?: string;
}

export interface CohereWorkerProxyOptions {
	fetchImpl?: typeof fetch;
	logEvent?: (event: StreamEvent) => void;
}

interface CohereProxyBody {
	messages?: unknown[];
	prompt?: string;
	stream?: boolean;
	model?: string;
	tools?: unknown[];
}

/**
 * Cloudflare Worker / fetch proxy for Cohere Chat v2 SSE.
 *
 * Upstream: POST https://api.cohere.com/v2/chat with stream: true.
 * Cohere is not OpenAI-compatible — use cohereAdapter(), not openaiCompatibleAdapter().
 */
export async function handleCohereWorkerProxy(
	request: Request,
	env: CohereWorkerProxyEnv,
	options: CohereWorkerProxyOptions = {},
): Promise<Response> {
	const parsed = await parseCohereProxyBody(request);
	if (!parsed.ok) {
		return jsonError(parsed.error, 400);
	}

	const apiKey = env.COHERE_API_KEY;
	if (!apiKey) return jsonError("Worker proxy is not configured.", 500);

	const fetchImpl = options.fetchImpl ?? fetch;
	const upstreamResponse = await fetchImpl("https://api.cohere.com/v2/chat", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(upstreamBody(parsed.body, env.COHERE_MODEL)),
		signal: request.signal,
	});

	if (!upstreamResponse.ok || !upstreamResponse.body) {
		return jsonError("Upstream Cohere request failed.", 502);
	}

	const events = assembleStream(upstreamResponse.body, cohereAdapter(), {
		signal: request.signal,
	});
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

export interface CohereWorkerProxyExampleOptions extends CohereWorkerProxyOptions {
	apiKey?: string;
	write?: (text: string) => void;
}

export async function runCohereWorkerProxyExample(
	options: CohereWorkerProxyExampleOptions = {},
): Promise<void> {
	const write = options.write ?? ((text: string) => process.stdout.write(text));
	const request = new Request("https://worker.example/cohere-proxy", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ prompt: "hi", stream: true }),
	});
	const response = await handleCohereWorkerProxy(
		request,
		{ COHERE_API_KEY: options.apiKey ?? "test-key", COHERE_MODEL: "command-r-plus-08-2024" },
		options,
	);
	write(await response.text());
}

async function parseCohereProxyBody(
	request: Request,
): Promise<{ ok: true; body: CohereProxyBody } | { ok: false; error: string }> {
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
	const proxyBody: CohereProxyBody = {
		messages: Array.isArray(record.messages) ? record.messages : undefined,
		prompt: typeof record.prompt === "string" ? record.prompt : undefined,
		stream: typeof record.stream === "boolean" ? record.stream : undefined,
		model: typeof record.model === "string" ? record.model : undefined,
		tools: Array.isArray(record.tools) ? record.tools : undefined,
	};
	if (!proxyBody.messages && !proxyBody.prompt) {
		return { ok: false, error: "Request body must include messages or prompt." };
	}
	return { ok: true, body: proxyBody };
}

function upstreamBody(body: CohereProxyBody, fallbackModel?: string) {
	const messages = body.messages ?? [{ role: "user", content: body.prompt }];
	return {
		model: body.model ?? fallbackModel ?? "command-r-plus-08-2024",
		messages,
		stream: body.stream ?? true,
		...(body.tools ? { tools: body.tools } : {}),
	};
}

function jsonError(message: string, status: number): Response {
	return new Response(JSON.stringify({ error: message }), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}
