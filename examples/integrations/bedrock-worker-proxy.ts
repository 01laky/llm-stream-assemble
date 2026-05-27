import {
	assembleFromPayloads,
	bedrockAdapter,
	toSSE,
	tapEvents,
	type StreamEvent,
} from "../../src/index";
import { decodedBedrockEventPayloads } from "../bedrock/decode-event-stream";

export interface BedrockWorkerProxyEnv {
	AWS_REGION?: string;
	BEDROCK_MODEL_ID?: string;
}

export interface BedrockWorkerProxyOptions {
	fetchImpl?: typeof fetch;
	logEvent?: (event: StreamEvent) => void;
}

interface BedrockProxyBody {
	messages?: unknown[];
	prompt?: string;
	stream?: boolean;
	model?: string;
}

/**
 * Cloudflare Worker / fetch proxy for Bedrock ConverseStream.
 *
 * Upstream URL shape (signing is app responsibility):
 * https://bedrock-runtime.{region}.amazonaws.com/model/{modelId}/converse-stream
 */
export async function handleBedrockWorkerProxy(
	request: Request,
	env: BedrockWorkerProxyEnv,
	options: BedrockWorkerProxyOptions = {},
): Promise<Response> {
	const parsed = await parseBedrockProxyBody(request);
	if (!parsed.ok) {
		return jsonError(parsed.error, 400);
	}

	const region = env.AWS_REGION;
	const modelId = env.BEDROCK_MODEL_ID ?? parsed.body.model;
	if (!region) return jsonError("AWS_REGION is required.", 500);
	if (!modelId) return jsonError("BEDROCK_MODEL_ID is required.", 500);

	const fetchImpl = options.fetchImpl ?? fetch;
	const upstreamUrl = `https://bedrock-runtime.${region}.amazonaws.com/model/${encodeURIComponent(modelId)}/converse-stream`;

	const upstreamResponse = await fetchImpl(upstreamUrl, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify(upstreamBody(parsed.body)),
		signal: request.signal,
	});

	if (!upstreamResponse.ok || !upstreamResponse.body) {
		return jsonError("Upstream Bedrock request failed.", 502);
	}

	const events = eventsFromBedrockStream(upstreamResponse.body, request.signal);
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

async function* eventsFromBedrockStream(
	body: ReadableStream<Uint8Array>,
	signal?: AbortSignal,
): AsyncIterable<StreamEvent> {
	async function* payloadLines() {
		for await (const payload of decodedBedrockEventPayloads(body)) {
			yield payload;
		}
	}
	yield* assembleFromPayloads(payloadLines(), bedrockAdapter(), { signal });
}

export interface BedrockWorkerProxyExampleOptions extends BedrockWorkerProxyOptions {
	fixtureBytes?: Uint8Array;
	write?: (text: string) => void;
}

export async function runBedrockWorkerProxyExample(
	options: BedrockWorkerProxyExampleOptions = {},
): Promise<void> {
	const write = options.write ?? ((text: string) => process.stdout.write(text));
	const request = new Request("https://worker.example/bedrock", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ prompt: "hi", stream: true }),
	});

	const fixtureBytes = options.fixtureBytes;
	const fetchImpl =
		options.fetchImpl ??
		(async () =>
			new Response(fixtureBytes, {
				status: 200,
				headers: { "Content-Type": "application/vnd.amazon.eventstream" },
			}));

	const response = await handleBedrockWorkerProxy(
		request,
		{ AWS_REGION: "us-east-1", BEDROCK_MODEL_ID: "anthropic.claude-3-5-sonnet-20241022-v2:0" },
		{ fetchImpl },
	);
	write(await response.text());
}

async function parseBedrockProxyBody(
	request: Request,
): Promise<{ ok: true; body: BedrockProxyBody } | { ok: false; error: string }> {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return { ok: false, error: "Invalid JSON body." };
	}
	if (typeof body !== "object" || body === null) {
		return { ok: false, error: "Body must be an object." };
	}
	const record = body as BedrockProxyBody;
	if (!record.prompt && !record.messages) {
		return { ok: false, error: "Provide prompt or messages." };
	}
	return { ok: true, body: record };
}

function upstreamBody(body: BedrockProxyBody): Record<string, unknown> {
	if (body.messages) {
		return { messages: body.messages };
	}
	return {
		messages: [{ role: "user", content: [{ text: body.prompt ?? "" }] }],
	};
}

function jsonError(message: string, status: number): Response {
	return new Response(JSON.stringify({ error: message }), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}
