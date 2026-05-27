export type FinishReason =
	| "stop"
	| "tool_calls"
	| "length"
	| "content_filter"
	| "error"
	| "incomplete"
	| "aborted";

export type ReasoningVariant = "summary" | "detail";

export type StreamEvent =
	| { type: "message.start"; id?: string; choiceIndex?: number }
	| { type: "metadata"; model?: string; responseId?: string; created?: number; raw?: unknown }
	| { type: "text.delta"; text: string; choiceIndex?: number }
	| { type: "text.done"; text: string; choiceIndex?: number }
	| { type: "reasoning.delta"; text: string; variant?: ReasoningVariant }
	| { type: "reasoning.done"; text: string; variant?: ReasoningVariant }
	| { type: "refusal.delta"; text: string }
	| { type: "refusal.done"; text: string }
	| { type: "json.delta"; delta: string; partial?: unknown }
	| { type: "json.done"; value: unknown }
	| { type: "tool_call.start"; id: string; name: string; index?: number; choiceIndex?: number }
	| { type: "tool_call.args.delta"; id: string; delta: string; partial?: unknown }
	| { type: "tool_call.done"; id: string; name: string; args: unknown }
	| {
			type: "citation";
			index?: number;
			span?: { start: number; end: number; text?: string };
			sources?: unknown[];
			urls?: string[];
			searchResults?: unknown[];
			raw?: unknown;
	  }
	| {
			type: "grounding";
			queries?: string[];
			chunks?: unknown[];
			supports?: unknown[];
			raw?: unknown;
	  }
	| {
			type: "usage";
			inputTokens?: number;
			outputTokens?: number;
			reasoningTokens?: number;
			raw?: unknown;
	  }
	| { type: "finish"; reason: FinishReason; choiceIndex?: number }
	| { type: "error"; error: Error; recoverable?: boolean; sanitized?: string };

export interface StreamAdapter {
	parseChunk(raw: string): RawChunk[];
	parseResponse?(body: unknown): RawChunk[];
}

/** Internal representation between adapter output and assembler. */
export type RawChunk =
	| { kind: "message-start"; id?: string; choiceIndex?: number }
	| { kind: "text-delta"; text: string; choiceIndex?: number }
	| { kind: "reasoning-delta"; text: string; variant?: ReasoningVariant }
	| { kind: "refusal-delta"; text: string }
	| { kind: "json-delta"; delta: string }
	| { kind: "tool-start"; id?: string; name: string; index?: number; choiceIndex?: number }
	| { kind: "tool-args-delta"; id?: string; delta: string; index?: number; choiceIndex?: number }
	| { kind: "tool-done"; id?: string; index?: number; choiceIndex?: number }
	| { kind: "metadata"; model?: string; responseId?: string; created?: number; raw?: unknown }
	| {
			kind: "citation";
			index?: number;
			span?: { start: number; end: number; text?: string };
			sources?: unknown[];
			urls?: string[];
			searchResults?: unknown[];
			raw?: unknown;
	  }
	| {
			kind: "grounding";
			queries?: string[];
			chunks?: unknown[];
			supports?: unknown[];
			raw?: unknown;
	  }
	| {
			kind: "usage";
			inputTokens?: number;
			outputTokens?: number;
			reasoningTokens?: number;
			raw?: unknown;
	  }
	| { kind: "finish"; reason: FinishReason; choiceIndex?: number }
	| { kind: "provider-error"; error: unknown; recoverable?: boolean };

export interface AssembleOptions {
	recoverMalformed?: boolean;
	signal?: AbortSignal;
	sanitizeErrors?: boolean;
	strictToolArgs?: boolean;
	maxBufferBytes?: number;
}

export interface PartialJSONResult {
	value?: unknown;
	complete: boolean;
}

export interface CollectedStream {
	text: string;
	reasoning: string;
	refusals: string;
	json: unknown;
	toolCalls: Array<{ id: string; name: string; args: unknown }>;
	citations: Array<Extract<StreamEvent, { type: "citation" }>>;
	grounding: Array<Extract<StreamEvent, { type: "grounding" }>>;
	usage?: Extract<StreamEvent, { type: "usage" }>;
	finishReason?: Extract<StreamEvent, { type: "finish" }>;
}

export interface ToSSEOptions {
	sanitizeErrors?: boolean;
}

export interface AssembleFromFileOptions extends AssembleOptions {
	format?: "sse" | "json";
}

export type StreamEventType = StreamEvent["type"];

export type StreamEventHandlers<R> = Partial<{
	[K in StreamEventType]: (event: Extract<StreamEvent, { type: K }>) => R;
}>;
