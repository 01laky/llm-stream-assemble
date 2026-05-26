import { assembleStream, openaiCompatibleAdapter } from "../../src/index";

/**
 * LiteLLM exposes an OpenAI-compatible `/v1/chat/completions` API.
 * Alternatively set `OPENAI_COMPATIBLE_BASE_URL` to the same URL — see integration-cookbook.md.
 */
export interface LiteLLMExampleOptions {
	baseUrl?: string;
	apiKey?: string;
	model?: string;
	fetchImpl?: typeof fetch;
	write?: (text: string) => void;
}

export function resolveLiteLLMBaseUrl(options: LiteLLMExampleOptions = {}): string | undefined {
	return options.baseUrl ?? process.env.LITELLM_BASE_URL ?? process.env.OPENAI_COMPATIBLE_BASE_URL;
}

export async function runLiteLLMCompatibleExample(
	options: LiteLLMExampleOptions = {},
): Promise<void> {
	const baseUrl = resolveLiteLLMBaseUrl(options);
	const apiKey =
		options.apiKey ?? process.env.LITELLM_API_KEY ?? process.env.OPENAI_COMPATIBLE_API_KEY;
	const model = options.model ?? process.env.LITELLM_MODEL ?? process.env.OPENAI_COMPATIBLE_MODEL;
	if (!baseUrl) throw new Error("LITELLM_BASE_URL is required");
	if (!apiKey) throw new Error("LITELLM_API_KEY is required");
	if (!model) throw new Error("LITELLM_MODEL is required");

	const fetchImpl = options.fetchImpl ?? fetch;
	const write = options.write ?? ((text: string) => process.stdout.write(text));
	const response = await fetchImpl(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			model,
			messages: [{ role: "user", content: "Say hello in one short sentence." }],
			stream: true,
		}),
	});

	if (!response.body) throw new Error("LiteLLM response body is empty");

	for await (const event of assembleStream(
		response.body,
		openaiCompatibleAdapter({ provider: "generic" }),
	)) {
		if (event.type === "text.delta") write(event.text);
		if (event.type === "finish") write(`\nFinish: ${event.reason}\n`);
	}
}
