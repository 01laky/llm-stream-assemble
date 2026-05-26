import type { OpenAICompatibleProvider } from "../../src/adapters/openai-compatible";
import { runOpenAICompatibleExample } from "./openai-compatible";

/** Valid preset: `OPENAI_COMPATIBLE_PROVIDER=perplexity` */
export interface PerplexityExampleOptions {
	apiKey?: string;
	model?: string;
	baseUrl?: string;
	fetchImpl?: typeof fetch;
	write?: (text: string) => void;
}

export async function runPerplexityExample(options: PerplexityExampleOptions = {}): Promise<void> {
	const apiKey = options.apiKey ?? process.env.PERPLEXITY_API_KEY;
	if (!apiKey) throw new Error("PERPLEXITY_API_KEY is required");

	await runOpenAICompatibleExample({
		baseUrl: options.baseUrl ?? process.env.PERPLEXITY_BASE_URL ?? "https://api.perplexity.ai",
		apiKey,
		model: options.model ?? process.env.PERPLEXITY_MODEL ?? "sonar",
		provider: "perplexity" satisfies OpenAICompatibleProvider,
		fetchImpl: options.fetchImpl,
		write: options.write,
	});
}
