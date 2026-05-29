import type { LogprobPositionState } from "../common/logprobs";

export interface OpenAIResponsesAdapterOptions {
	jsonMode?: boolean;
}

export interface ToolState {
	id: string;
	name: string;
	index: number | undefined;
	args: string;
	started: boolean;
	done: boolean;
}

export interface ResponsesParserContext {
	readonly options: OpenAIResponsesAdapterOptions;
	metadataEmitted: boolean;
	textSeen: boolean;
	readonly logprobPositions: LogprobPositionState;
	readonly tools: Map<string, ToolState>;
}
