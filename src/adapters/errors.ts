/** Internal adapter error helpers. Not part of the public API. */
import type { RawChunk } from "../core/types";
import { asString } from "./utils";

export function libraryError(message: string): Error {
	return new Error(`llm-stream-assemble: ${message}`);
}

export function adapterScopedError(scope: string, message: string): Error {
	return new Error(`llm-stream-assemble: ${scope}: ${message}`);
}

export function providerErrorChunks(error: Error, recoverable = false): RawChunk[] {
	return [
		{ kind: "provider-error", error, recoverable },
		{ kind: "finish", reason: "error" },
	];
}

export function providerErrorChunksFromMessage(message: string, recoverable = false): RawChunk[] {
	return providerErrorChunks(libraryError(message), recoverable);
}

export function providerErrorChunksFromPayload(
	errorPayload: Record<string, unknown>,
	scope: string,
	recoverable: boolean,
	fallbackMessage: string,
): RawChunk[] {
	const message = asString(errorPayload.message) ?? fallbackMessage;
	const error = adapterScopedError(scope, message);
	Object.defineProperty(error, "raw", {
		value: errorPayload,
		enumerable: false,
	});
	return providerErrorChunks(error, recoverable);
}
