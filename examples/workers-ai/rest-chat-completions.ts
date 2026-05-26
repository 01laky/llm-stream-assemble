/**
 * Cloudflare Workers AI OpenAI-compatible REST example.
 *
 * Worker binding (not executed in CI): when `env.AI.run(model, { stream: true })`
 * returns SSE bytes shaped like Chat Completions, pass the body to
 * `assembleStream(body, openaiCompatibleAdapter({ provider: "cloudflare" }))`.
 */
import type { OpenAICompatibleProvider } from "../../src/adapters/openai-compatible";
import { assembleStream, openaiCompatibleAdapter } from "../../src/index";

/** Valid preset: `OPENAI_COMPATIBLE_PROVIDER=cloudflare` */
export interface CloudflareWorkersAIExampleOptions {
	apiToken?: string;
	accountId?: string;
	model?: string;
	fetchImpl?: typeof fetch;
	write?: (text: string) => void;
}

const DEFAULT_MODEL = "@cf/meta/llama-3.1-8b-instruct";

export function buildCloudflareWorkersAIChatCompletionsUrl(options: { accountId: string }): string {
	return `https://api.cloudflare.com/client/v4/accounts/${options.accountId}/ai/v1/chat/completions`;
}

export async function runCloudflareWorkersAIExample(
	options: CloudflareWorkersAIExampleOptions = {},
): Promise<void> {
	const apiToken = options.apiToken ?? process.env.CLOUDFLARE_API_TOKEN;
	const accountId = options.accountId ?? process.env.CLOUDFLARE_ACCOUNT_ID;
	const model = options.model ?? process.env.CLOUDFLARE_MODEL ?? DEFAULT_MODEL;

	if (!apiToken) throw new Error("CLOUDFLARE_API_TOKEN is required");
	if (!accountId) throw new Error("CLOUDFLARE_ACCOUNT_ID is required");

	const fetchImpl = options.fetchImpl ?? fetch;
	const write = options.write ?? ((text: string) => process.stdout.write(text));
	const url = buildCloudflareWorkersAIChatCompletionsUrl({ accountId });

	const response = await fetchImpl(url, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiToken}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			model,
			messages: [{ role: "user", content: "Say hello in one short sentence." }],
			stream: true,
			// Usage chunks require explicit opt-in on OpenAI-compatible APIs.
			stream_options: { include_usage: true },
		}),
	});

	if (!response.body) throw new Error("Cloudflare Workers AI response body is empty");

	for await (const event of assembleStream(
		response.body,
		openaiCompatibleAdapter({ provider: "cloudflare" satisfies OpenAICompatibleProvider }),
	)) {
		if (event.type === "text.delta") write(event.text);
		if (event.type === "finish") write(`\nFinish: ${event.reason}\n`);
	}
}
