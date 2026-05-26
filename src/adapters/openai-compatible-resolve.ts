import {
	DEFAULT_PRESET,
	type OpenAICompatibleProvider,
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

export interface ResolvedCompatibleAdapterConfig {
	looseErrorShape: boolean;
	allowMissingMetadata: boolean;
	useChoicePositionFallback: boolean;
	rejectUnrecognizedPayloads: boolean;
	reasoningFieldAliases: string[];
}

export function resolveCompatibleAdapterConfig(
	options: OpenAICompatibleAdapterOptions = {},
): ResolvedCompatibleAdapterConfig {
	const preset = providerPreset(options.provider ?? "generic");
	const allowMissingMetadata =
		options.allowMissingMetadata ??
		preset.allowMissingMetadata ??
		DEFAULT_PRESET.allowMissingMetadata;
	const looseErrorShape =
		options.looseErrorShape ?? preset.looseErrorShape ?? DEFAULT_PRESET.looseErrorShape;
	const useChoicePositionFallback =
		options.useChoicePositionFallback ??
		preset.useChoicePositionFallback ??
		DEFAULT_PRESET.useChoicePositionFallback;

	return {
		looseErrorShape,
		allowMissingMetadata,
		useChoicePositionFallback,
		rejectUnrecognizedPayloads: allowMissingMetadata === false,
		reasoningFieldAliases: [
			...(preset.reasoningFieldAliases ?? []),
			...(options.reasoningFieldAliases ?? []),
		],
	};
}

export function compatibleProviderLabel(provider: OpenAICompatibleProvider | undefined): string {
	return provider ?? "generic";
}
