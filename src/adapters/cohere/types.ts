import type { UsageFieldAliases } from "../common/usage";

export interface CohereAdapterOptions {
	/** Map content-delta text to json-delta instead of text-delta. */
	jsonMode?: boolean;
	/** @deprecated Dual-emit legacy metadata.raw citation blobs alongside typed events. */
	emitLegacyCitationMetadata?: boolean;
}

export interface ToolState {
	id: string;
	name: string;
	index: number;
	open: boolean;
	lastArgsJson: string;
}

export type CohereStreamEvent = Record<string, unknown> & { type?: string };

export const COHERE_USAGE_ALIASES: UsageFieldAliases = {
	input: ["input_tokens", "inputTokens"],
	output: ["output_tokens", "outputTokens"],
	total: ["total_tokens", "totalTokens"],
};
