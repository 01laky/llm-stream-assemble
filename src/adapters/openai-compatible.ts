import type { StreamAdapter } from "../core/types";
import { createOpenAIChatLikeAdapter } from "./openai-chat/parser";

export type OpenAICompatibleProvider =
	| "generic"
	| "openrouter"
	| "groq"
	| "ollama"
	| "lmstudio"
	| "together"
	| "fireworks";

export interface OpenAICompatibleAdapterOptions {
	provider?: OpenAICompatibleProvider;
	jsonMode?: boolean;
	legacyFunctionIdPrefix?: string;
	looseErrorShape?: boolean;
	allowMissingMetadata?: boolean;
	useChoicePositionFallback?: boolean;
	allowMissingToolIds?: boolean;
	reasoningFieldAliases?: string[];
}

export function openaiCompatibleAdapter(
	options: OpenAICompatibleAdapterOptions = {},
): StreamAdapter {
	const preset = providerPreset(options.provider ?? "generic");
	return createOpenAIChatLikeAdapter({
		...preset,
		...options,
		errorPrefix: "openaiCompatibleAdapter",
		usageInputTokenFields: ["prompt_tokens", "input_tokens"],
		usageOutputTokenFields: ["completion_tokens", "output_tokens"],
		rejectUnrecognizedPayloads: options.allowMissingMetadata === false,
		reasoningFieldAliases: [
			...(preset.reasoningFieldAliases ?? []),
			...(options.reasoningFieldAliases ?? []),
		],
	});
}

function providerPreset(
	provider: OpenAICompatibleProvider,
): Required<
	Pick<
		OpenAICompatibleAdapterOptions,
		"looseErrorShape" | "allowMissingMetadata" | "useChoicePositionFallback" | "allowMissingToolIds"
	>
> &
	Pick<OpenAICompatibleAdapterOptions, "reasoningFieldAliases"> {
	const base = {
		looseErrorShape: true,
		allowMissingMetadata: true,
		useChoicePositionFallback: true,
		allowMissingToolIds: true,
		reasoningFieldAliases: ["thinking", "thinking_content"],
	};

	switch (provider) {
		case "openrouter":
			return { ...base, reasoningFieldAliases: ["reasoning"] };
		case "groq":
			return base;
		case "ollama":
			return base;
		case "lmstudio":
			return base;
		case "together":
			return { ...base, reasoningFieldAliases: ["reasoning", "reasoning_delta"] };
		case "fireworks":
			return base;
		case "generic":
			return base;
	}
}
