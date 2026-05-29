export type BedrockModelFamily = "anthropic" | "openai-like" | "nova" | "auto";

export interface BedrockAdapterOptions {
	/**
	 * Hint which ConverseStream payload dialect to prefer when envelopes overlap.
	 * "auto" uses structural detection (document heuristics in adapter-guide).
	 */
	modelFamily?: BedrockModelFamily;
	/** Map structured JSON text blocks to json-delta instead of text-delta. */
	jsonMode?: boolean;
}

export interface BlockToolState {
	id: string;
	name: string;
	index: number;
	open: boolean;
	lastArgsJson: string;
}
