import type { OpenAICompatibleProvider } from "../../src/adapters/openai-compatible";
import { runOpenAICompatibleExample } from "./openai-compatible";

/** Valid preset: `OPENAI_COMPATIBLE_PROVIDER=xai` (not `grok`) */
export interface XaiExampleOptions {
	apiKey?: string;
	model?: string;
	baseUrl?: string;
	fetchImpl?: typeof fetch;
	write?: (text: string) => void;
}

export async function runXaiExample(options: XaiExampleOptions = {}): Promise<void> {
	const apiKey = options.apiKey ?? process.env.XAI_API_KEY;
	if (!apiKey) throw new Error("XAI_API_KEY is required");

	await runOpenAICompatibleExample({
		baseUrl: options.baseUrl ?? process.env.XAI_BASE_URL ?? "https://api.x.ai/v1",
		apiKey,
		model: options.model ?? process.env.XAI_MODEL ?? "grok-3",
		provider: "xai" satisfies OpenAICompatibleProvider,
		fetchImpl: options.fetchImpl,
		write: options.write,
	});
}
