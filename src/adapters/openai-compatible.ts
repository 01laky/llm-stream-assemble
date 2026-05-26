import type { StreamAdapter } from "../core/types";
import { createOpenAIChatLikeAdapter } from "./openai-chat/parser";
import {
	resolveCompatibleAdapterConfig,
	type OpenAICompatibleAdapterOptions,
} from "./openai-compatible-resolve";

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
export {
	type OpenAICompatibleAdapterOptions,
	type ResolvedCompatibleAdapterConfig,
	compatibleProviderLabel,
	resolveCompatibleAdapterConfig,
} from "./openai-compatible-resolve";

export function openaiCompatibleAdapter(
	options: OpenAICompatibleAdapterOptions = {},
): StreamAdapter {
	const resolved = resolveCompatibleAdapterConfig(options);

	return createOpenAIChatLikeAdapter({
		...options,
		looseErrorShape: resolved.looseErrorShape,
		allowMissingMetadata: resolved.allowMissingMetadata,
		useChoicePositionFallback: resolved.useChoicePositionFallback,
		errorPrefix: "openaiCompatibleAdapter",
		usageInputTokenFields: ["prompt_tokens", "input_tokens"],
		usageOutputTokenFields: ["completion_tokens", "output_tokens"],
		rejectUnrecognizedPayloads: resolved.rejectUnrecognizedPayloads,
		reasoningFieldAliases: resolved.reasoningFieldAliases,
	});
}
