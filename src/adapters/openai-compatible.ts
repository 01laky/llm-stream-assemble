import type { StreamAdapter } from "../core/types";
import { createOpenAIChatLikeAdapter } from "./openai-chat/parser";

export type OpenAICompatibleProvider =
	| "generic"
	| "openrouter"
	| "groq"
	| "deepseek"
	| "mistral"
	| "ollama"
	| "lmstudio"
	| "together"
	| "fireworks"
	| "perplexity"
	| "xai"
	| "azure"
	| "cloudflare";

export interface OpenAICompatibleAdapterOptions {
	provider?: OpenAICompatibleProvider;
	jsonMode?: boolean;
	legacyFunctionIdPrefix?: string;
	looseErrorShape?: boolean;
	allowMissingMetadata?: boolean;
	useChoicePositionFallback?: boolean;
	reasoningFieldAliases?: string[];
}

type PresetOverrides = Partial<
	Pick<
		OpenAICompatibleAdapterOptions,
		| "reasoningFieldAliases"
		| "looseErrorShape"
		| "allowMissingMetadata"
		| "useChoicePositionFallback"
	>
>;

const DEFAULT_PRESET = {
	looseErrorShape: true,
	allowMissingMetadata: true,
	useChoicePositionFallback: true,
	reasoningFieldAliases: ["thinking", "thinking_content"],
} as const satisfies PresetOverrides;

const PRESET_OVERRIDES: Partial<Record<OpenAICompatibleProvider, PresetOverrides>> = {
	deepseek: { reasoningFieldAliases: ["reasoning_content", "reasoning", "thinking"] },
	openrouter: { reasoningFieldAliases: ["reasoning"] },
	together: { reasoningFieldAliases: ["reasoning", "reasoning_delta"] },
	azure: {
		looseErrorShape: false,
		allowMissingMetadata: false,
		useChoicePositionFallback: true,
		reasoningFieldAliases: [],
	},
};

export function openaiCompatibleAdapter(
	options: OpenAICompatibleAdapterOptions = {},
): StreamAdapter {
	const preset = providerPreset(options.provider ?? "generic");
	const resolvedAllowMissingMetadata =
		options.allowMissingMetadata ??
		preset.allowMissingMetadata ??
		DEFAULT_PRESET.allowMissingMetadata;
	const resolvedLooseErrorShape =
		options.looseErrorShape ?? preset.looseErrorShape ?? DEFAULT_PRESET.looseErrorShape;
	const resolvedUseChoicePositionFallback =
		options.useChoicePositionFallback ??
		preset.useChoicePositionFallback ??
		DEFAULT_PRESET.useChoicePositionFallback;

	return createOpenAIChatLikeAdapter({
		...options,
		looseErrorShape: resolvedLooseErrorShape,
		allowMissingMetadata: resolvedAllowMissingMetadata,
		useChoicePositionFallback: resolvedUseChoicePositionFallback,
		errorPrefix: "openaiCompatibleAdapter",
		usageInputTokenFields: ["prompt_tokens", "input_tokens"],
		usageOutputTokenFields: ["completion_tokens", "output_tokens"],
		rejectUnrecognizedPayloads: resolvedAllowMissingMetadata === false,
		reasoningFieldAliases: [
			...(preset.reasoningFieldAliases ?? []),
			...(options.reasoningFieldAliases ?? []),
		],
	});
}

function providerPreset(provider: OpenAICompatibleProvider): PresetOverrides {
	return {
		...DEFAULT_PRESET,
		...PRESET_OVERRIDES[provider],
	};
}
