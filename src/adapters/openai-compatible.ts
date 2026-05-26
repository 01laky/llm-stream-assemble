import type { StreamAdapter } from "../core/types";
import { createOpenAIChatLikeAdapter } from "./openai-chat/parser";
import {
	DEFAULT_PRESET,
	type OpenAICompatibleProvider,
	providerPreset,
} from "./openai-compatible-presets";

export type { OpenAICompatibleProvider } from "./openai-compatible-presets";
export {
	DEFAULT_PRESET,
	HOST_COMPATIBLE_PRESETS,
	LOOSE_HOST_PRESETS,
	OPENAI_COMPATIBLE_PROVIDERS,
	PRESET_OVERRIDE_KEYS,
	PRESET_OVERRIDES,
	STRICT_COMPATIBLE_PRESETS,
	hasPresetOverride,
	isStrictCompatiblePreset,
	providerPreset,
} from "./openai-compatible-presets";

export interface OpenAICompatibleAdapterOptions {
	provider?: OpenAICompatibleProvider;
	jsonMode?: boolean;
	legacyFunctionIdPrefix?: string;
	looseErrorShape?: boolean;
	allowMissingMetadata?: boolean;
	useChoicePositionFallback?: boolean;
	reasoningFieldAliases?: string[];
}

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
