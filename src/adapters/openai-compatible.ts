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
	reasoningFieldAliases?: string[];
}

const DEFAULT_PRESET = {
	looseErrorShape: true,
	allowMissingMetadata: true,
	useChoicePositionFallback: true,
	reasoningFieldAliases: ["thinking", "thinking_content"],
} as const;

const PRESET_OVERRIDES: Partial<
	Record<OpenAICompatibleProvider, Pick<OpenAICompatibleAdapterOptions, "reasoningFieldAliases">>
> = {
	openrouter: { reasoningFieldAliases: ["reasoning"] },
	together: { reasoningFieldAliases: ["reasoning", "reasoning_delta"] },
};

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

function providerPreset(provider: OpenAICompatibleProvider) {
	return {
		...DEFAULT_PRESET,
		...PRESET_OVERRIDES[provider],
	};
}
