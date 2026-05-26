import type { OpenAICompatibleProvider } from "../../src/adapters/openai-compatible";
import { assembleStream, openaiCompatibleAdapter } from "../../src/index";

/** Valid preset: `OPENAI_COMPATIBLE_PROVIDER=azure` */
export interface AzureOpenAIExampleOptions {
	apiKey?: string;
	resource?: string;
	deployment?: string;
	apiVersion?: string;
	fetchImpl?: typeof fetch;
	write?: (text: string) => void;
}

const DEFAULT_API_VERSION = "2024-10-21";

export function buildAzureOpenAIChatCompletionsUrl(options: {
	resource: string;
	deployment: string;
	apiVersion?: string;
}): string {
	const apiVersion = options.apiVersion ?? DEFAULT_API_VERSION;
	return `https://${options.resource}.openai.azure.com/openai/deployments/${options.deployment}/chat/completions?api-version=${apiVersion}`;
}

export async function runAzureOpenAIExample(
	options: AzureOpenAIExampleOptions = {},
): Promise<void> {
	const apiKey = options.apiKey ?? process.env.AZURE_OPENAI_API_KEY;
	const resource = options.resource ?? process.env.AZURE_OPENAI_RESOURCE;
	const deployment = options.deployment ?? process.env.AZURE_OPENAI_DEPLOYMENT;
	const apiVersion =
		options.apiVersion ?? process.env.AZURE_OPENAI_API_VERSION ?? DEFAULT_API_VERSION;

	if (!apiKey) throw new Error("AZURE_OPENAI_API_KEY is required");
	if (!resource) throw new Error("AZURE_OPENAI_RESOURCE is required");
	if (!deployment) throw new Error("AZURE_OPENAI_DEPLOYMENT is required");

	const fetchImpl = options.fetchImpl ?? fetch;
	const write = options.write ?? ((text: string) => process.stdout.write(text));
	const url = buildAzureOpenAIChatCompletionsUrl({ resource, deployment, apiVersion });

	const response = await fetchImpl(url, {
		method: "POST",
		headers: {
			"api-key": apiKey,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			messages: [{ role: "user", content: "Say hello in one short sentence." }],
			stream: true,
			stream_options: { include_usage: true },
		}),
	});

	if (!response.body) throw new Error("Azure OpenAI response body is empty");

	for await (const event of assembleStream(
		response.body,
		openaiCompatibleAdapter({ provider: "azure" satisfies OpenAICompatibleProvider }),
	)) {
		if (event.type === "text.delta") write(event.text);
		if (event.type === "finish") write(`\nFinish: ${event.reason}\n`);
	}
}
