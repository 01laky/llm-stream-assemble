import type { StreamAdapter } from "../core/types";
import { createOpenAIChatLikeAdapter } from "./openai-chat/parser";

export interface OpenAIChatAdapterOptions {
	jsonMode?: boolean;
	legacyFunctionIdPrefix?: string;
}

export function openaiChatAdapter(options: OpenAIChatAdapterOptions = {}): StreamAdapter {
	return createOpenAIChatLikeAdapter({
		...options,
		errorPrefix: "openaiChatAdapter",
		looseErrorShape: false,
		allowMissingMetadata: false,
		useChoicePositionFallback: true,
		usageInputTokenFields: ["prompt_tokens"],
		usageOutputTokenFields: ["completion_tokens"],
	});
}
