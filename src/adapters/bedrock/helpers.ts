import type { RawChunk } from "../../core/types";
import { asString, isRecord, optionalRawChunk } from "../utils";
import type { BedrockModelFamily } from "./types";

export const EXCEPTION_KEYS = [
	"internalServerException",
	"modelStreamErrorException",
	"validationException",
	"throttlingException",
	"serviceUnavailableException",
] as const;

export function reasoningTextFromDelta(
	reasoning: unknown,
	modelFamily: BedrockModelFamily | undefined,
): string | undefined {
	if (reasoning === undefined) return undefined;
	if (typeof reasoning === "string") return reasoning.length > 0 ? reasoning : undefined;
	if (!isRecord(reasoning)) return undefined;

	const text = asString(reasoning.text);
	if (text !== undefined && text.length > 0) return text;

	if (modelFamily === "anthropic" || modelFamily === "auto") {
		const thinking = asString(reasoning.thinking);
		if (thinking !== undefined && thinking.length > 0) return thinking;
	}

	return undefined;
}

export function optionalMetadataRaw(payload: Record<string, unknown>): RawChunk[] {
	if (Object.keys(payload).length === 0) return [];
	return [
		optionalRawChunk({
			kind: "metadata",
			raw: payload,
		}),
	];
}
