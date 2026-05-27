import type { RawChunk } from "../../core/types";
import { asNumber, isRecord, optionalRawChunk } from "../utils";

export interface UsageFieldAliases {
	input?: string[];
	output?: string[];
	reasoning?: string[];
	total?: string[];
}

const DEFAULT_ALIASES: UsageFieldAliases = {
	input: ["inputTokens", "input_tokens", "promptTokens", "promptTokenCount", "inputTokenCount"],
	output: [
		"outputTokens",
		"output_tokens",
		"completionTokens",
		"candidatesTokenCount",
		"outputTokenCount",
	],
	reasoning: ["reasoningTokens", "reasoning_tokens", "thoughtsTokenCount"],
	total: ["totalTokens", "totalTokenCount", "total_tokens"],
};

function firstNumber(
	value: Record<string, unknown>,
	fields: string[] | undefined,
): number | undefined {
	if (!fields) return undefined;
	for (const field of fields) {
		const number = asNumber(value[field]);
		if (number !== undefined) return number;
	}
	return undefined;
}

export function buildUsageChunk(
	value: unknown,
	aliases: UsageFieldAliases = DEFAULT_ALIASES,
	options?: { mirrorTotalTokens?: boolean },
): RawChunk | undefined {
	if (!isRecord(value)) return undefined;
	const inputTokens = firstNumber(value, aliases.input);
	const outputTokens = firstNumber(value, aliases.output);
	const reasoningTokens = firstNumber(value, aliases.reasoning);
	const totalTokens = firstNumber(value, aliases.total);
	if (
		inputTokens === undefined &&
		outputTokens === undefined &&
		reasoningTokens === undefined &&
		totalTokens === undefined
	) {
		return undefined;
	}
	const raw =
		options?.mirrorTotalTokens && totalTokens !== undefined ? { ...value, totalTokens } : value;
	return optionalRawChunk({
		kind: "usage",
		inputTokens,
		outputTokens,
		reasoningTokens,
		raw,
	});
}
