import { assembleStream, openaiCompatibleAdapter } from "../../src/index";
import type { OpenAICompatibleProvider } from "../../src/adapters/openai-compatible";

/** Valid `OPENAI_COMPATIBLE_PROVIDER` values include `generic`, `openrouter`, `groq`, `deepseek`, `mistral`, `ollama`, `lmstudio`, `together`, `fireworks`, `perplexity`, `xai`, `azure`. */

export interface OpenAICompatibleExampleOptions {
	baseUrl?: string;
	apiKey?: string;
	model?: string;
	provider?: OpenAICompatibleProvider;
	fetchImpl?: typeof fetch;
	write?: (text: string) => void;
}

export async function runOpenAICompatibleExample(
	options: OpenAICompatibleExampleOptions = {},
): Promise<void> {
	const baseUrl = options.baseUrl ?? process.env.OPENAI_COMPATIBLE_BASE_URL;
	const apiKey = options.apiKey ?? process.env.OPENAI_COMPATIBLE_API_KEY;
	const model = options.model ?? process.env.OPENAI_COMPATIBLE_MODEL;
	const provider =
		options.provider ??
		(process.env.OPENAI_COMPATIBLE_PROVIDER as OpenAICompatibleProvider | undefined) ??
		"generic";
	if (!baseUrl) throw new Error("OPENAI_COMPATIBLE_BASE_URL is required");
	if (!apiKey) throw new Error("OPENAI_COMPATIBLE_API_KEY is required");
	if (!model) throw new Error("OPENAI_COMPATIBLE_MODEL is required");

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

	if (!response.body) throw new Error("OpenAI-compatible response body is empty");

	for await (const event of assembleStream(response.body, openaiCompatibleAdapter({ provider }))) {
		if (event.type === "text.delta") write(event.text);
		if (event.type === "finish") write(`\nFinish: ${event.reason}\n`);
	}
}
