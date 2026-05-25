import {
	anthropicAdapter,
	assembleStream,
	openaiChatAdapter,
	openaiCompatibleAdapter,
	tapEvents,
	toSSE,
	type StreamEvent,
} from "../../src/index";

export interface ProxyExampleOptions {
	fetchImpl?: typeof fetch;
	apiKey?: string;
	model?: string;
	upstreamUrl?: string;
	logEvent?: (event: StreamEvent) => void;
	redactLogEvent?: (event: StreamEvent) => unknown;
}

interface ProxyRequestBody {
	provider?: "openai" | "openai-compatible" | "anthropic";
	model?: string;
	messages?: unknown[];
	prompt?: string;
	stream?: boolean;
}

export async function handleLLMProxyRequest(
	request: Request,
	options: ProxyExampleOptions = {},
): Promise<Response> {
	const parsed = await parseProxyRequest(request);
	if (!parsed.ok) return safeJSONError(parsed.error, 400);

	const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
	if (!apiKey) return safeJSONError("LLM proxy is not configured.", 500);

	const provider = parsed.body.provider ?? "openai";
	const upstream = upstreamFor(provider, options.upstreamUrl);
	const fetchImpl = options.fetchImpl ?? fetch;
	const upstreamResponse = await fetchImpl(upstream.url, {
		method: "POST",
		headers: upstreamHeaders(provider, apiKey),
		body: JSON.stringify(upstreamBody(parsed.body, options.model)),
		signal: request.signal,
	});

	if (!upstreamResponse.ok || !upstreamResponse.body) {
		return safeJSONError("Upstream LLM request failed.", 502);
	}

	const adapter = adapterFor(provider);
	const events = assembleStream(upstreamResponse.body, adapter, {
		signal: request.signal,
	});
	const tapped = tapEvents(events, (event) => {
		const redacted = (options.redactLogEvent ?? redactEventForLog)(event);
		options.logEvent?.(redacted as StreamEvent);
	});

	return new Response(toSSE(tapped, { sanitizeErrors: true }), {
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
		},
	});
}

export function redactEventForLog(event: StreamEvent): unknown {
	return JSON.parse(
		JSON.stringify(event, (_key, value: unknown) => {
			if (typeof value !== "string") return value;
			return value
				.replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [REDACTED]")
				.replace(/sk-[A-Za-z0-9_-]+/g, "sk-[REDACTED]")
				.replace(/[A-Za-z0-9_-]{32,}/g, "[REDACTED]");
		}),
	) as unknown;
}

function adapterFor(provider: NonNullable<ProxyRequestBody["provider"]>) {
	if (provider === "anthropic") return anthropicAdapter();
	if (provider === "openai-compatible") return openaiCompatibleAdapter({ provider: "generic" });
	return openaiChatAdapter();
}

function upstreamFor(
	provider: NonNullable<ProxyRequestBody["provider"]>,
	override: string | undefined,
) {
	if (override) return { url: override };
	if (provider === "anthropic") return { url: "https://api.anthropic.com/v1/messages" };
	return { url: "https://api.openai.com/v1/chat/completions" };
}

function upstreamHeaders(provider: NonNullable<ProxyRequestBody["provider"]>, apiKey: string) {
	if (provider === "anthropic") {
		return {
			"x-api-key": apiKey,
			"anthropic-version": "2023-06-01",
			"Content-Type": "application/json",
		};
	}
	return {
		Authorization: `Bearer ${apiKey}`,
		"Content-Type": "application/json",
	};
}

function upstreamBody(body: ProxyRequestBody, fallbackModel: string | undefined) {
	const messages = body.messages ?? [{ role: "user", content: body.prompt }];
	return {
		model: body.model ?? fallbackModel ?? "gpt-4o-mini",
		messages,
		stream: body.stream ?? true,
	};
}

async function parseProxyRequest(
	request: Request,
): Promise<{ ok: true; body: ProxyRequestBody } | { ok: false; error: string }> {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return { ok: false, error: "Request body must be JSON." };
	}
	if (!isRecord(body)) return { ok: false, error: "Request body must be an object." };
	const proxyBody: ProxyRequestBody = {
		provider: providerValue(body.provider),
		model: stringValue(body.model),
		messages: Array.isArray(body.messages) ? body.messages : undefined,
		prompt: stringValue(body.prompt),
		stream: typeof body.stream === "boolean" ? body.stream : undefined,
	};
	if (!proxyBody.messages && !proxyBody.prompt) {
		return { ok: false, error: "Request body must include messages or prompt." };
	}
	return { ok: true, body: proxyBody };
}

function safeJSONError(message: string, status: number): Response {
	return new Response(JSON.stringify({ error: message }), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

function providerValue(value: unknown): ProxyRequestBody["provider"] {
	return value === "openai" || value === "openai-compatible" || value === "anthropic"
		? value
		: undefined;
}

function stringValue(value: unknown): string | undefined {
	return typeof value === "string" ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
