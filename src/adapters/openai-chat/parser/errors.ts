import type { RawChunk } from "../../../core/types";
import { asString, isRecord } from "../../utils";
import { adapterScopedError, providerErrorChunksFromPayload } from "../../errors";
import type { RequiredOpenAIChatLikeParserOptions } from "./types";

export function providerErrorPayload(
	payload: Record<string, unknown>,
	options: RequiredOpenAIChatLikeParserOptions,
): Record<string, unknown> | undefined {
	if (isRecord(payload.error)) return payload.error;
	if (!options.looseErrorShape) return undefined;

	const errorString = asString(payload.error);
	if (errorString) return { message: errorString };

	const detailString = asString(payload.detail);
	if (detailString) return { message: detailString };
	if (isRecord(payload.detail)) return payload.detail;

	const topLevelMessage = asString(payload.message);
	const topLevelType = asString(payload.type);
	if (topLevelMessage && topLevelType === "error") return { message: topLevelMessage };

	return undefined;
}

export function openAIProviderErrorChunks(
	errorPayload: Record<string, unknown>,
	recoverable: boolean,
	options: RequiredOpenAIChatLikeParserOptions,
): RawChunk[] {
	return providerErrorChunksFromPayload(
		errorPayload,
		options.errorPrefix,
		recoverable,
		"OpenAI-compatible provider error",
	);
}

export function throwAdapterObjectError(scope: string, message = "expected a JSON object"): never {
	throw adapterScopedError(scope, message);
}

export function throwUnrecognizedChunkError(options: RequiredOpenAIChatLikeParserOptions): never {
	throw adapterScopedError(
		`${options.errorPrefix}.parseChunk`,
		"expected an OpenAI-compatible chat completion chunk",
	);
}

export function throwUnrecognizedResponseError(
	options: RequiredOpenAIChatLikeParserOptions,
): never {
	throw adapterScopedError(
		`${options.errorPrefix}.parseResponse`,
		"expected an OpenAI-compatible chat completion object",
	);
}

export { adapterScopedError };
