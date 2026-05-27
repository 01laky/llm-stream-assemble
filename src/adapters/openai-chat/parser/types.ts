export interface OpenAIChatLikeParserOptions {
	jsonMode?: boolean;
	legacyFunctionIdPrefix?: string;
	errorPrefix: "openaiChatAdapter" | "openaiCompatibleAdapter";
	looseErrorShape?: boolean;
	allowMissingMetadata?: boolean;
	useChoicePositionFallback?: boolean;
	reasoningFieldAliases?: string[];
	usageInputTokenFields?: string[];
	usageOutputTokenFields?: string[];
	rejectUnrecognizedPayloads?: boolean;
	/** @deprecated Dual-emit legacy metadata.raw citation blobs alongside typed events. */
	emitLegacyCitationMetadata?: boolean;
}

export interface RequiredOpenAIChatLikeParserOptions {
	jsonMode: boolean;
	legacyFunctionIdPrefix: string;
	errorPrefix: "openaiChatAdapter" | "openaiCompatibleAdapter";
	looseErrorShape: boolean;
	allowMissingMetadata: boolean;
	useChoicePositionFallback: boolean;
	reasoningFieldAliases: string[];
	usageInputTokenFields: string[];
	usageOutputTokenFields: string[];
	rejectUnrecognizedPayloads: boolean;
	emitLegacyCitationMetadata: boolean;
}

export function normalizeOptions(
	options: OpenAIChatLikeParserOptions,
): RequiredOpenAIChatLikeParserOptions {
	return {
		jsonMode: options.jsonMode ?? false,
		legacyFunctionIdPrefix: options.legacyFunctionIdPrefix ?? "legacy_function",
		errorPrefix: options.errorPrefix,
		looseErrorShape: options.looseErrorShape ?? false,
		allowMissingMetadata: options.allowMissingMetadata ?? false,
		useChoicePositionFallback: options.useChoicePositionFallback ?? true,
		reasoningFieldAliases: options.reasoningFieldAliases ?? [],
		usageInputTokenFields: options.usageInputTokenFields ?? ["prompt_tokens"],
		usageOutputTokenFields: options.usageOutputTokenFields ?? ["completion_tokens"],
		rejectUnrecognizedPayloads: options.rejectUnrecognizedPayloads ?? false,
		emitLegacyCitationMetadata: options.emitLegacyCitationMetadata ?? false,
	};
}

export interface ToolState {
	id?: string;
	name: string;
	startEmitted: boolean;
	sawArguments: boolean;
}
