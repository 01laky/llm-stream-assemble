import type { StreamEvent } from "../../src/core/types";

/** Illustrative mapping — verify against your @ai-sdk/* version when adopting. */
export type AISDKStylePart =
	| { type: "text-delta"; textDelta: string }
	| { type: "tool-call"; toolCallId: string; toolName: string; args: unknown }
	| { type: "citation"; urls?: string[]; sources?: unknown[] }
	| { type: "grounding"; queries?: string[]; chunks?: unknown[] }
	| { type: "token-logprob"; token: string; logprob: number; topLogprobs?: unknown[] }
	| { type: "finish"; finishReason: string }
	| { type: "error"; message: string };

export function mapStreamEventToAISDKPart(
	event: StreamEvent,
): AISDKStylePart | AISDKStylePart[] | null {
	switch (event.type) {
		case "text.delta":
			return { type: "text-delta", textDelta: event.text };
		case "tool_call.done":
			return {
				type: "tool-call",
				toolCallId: event.id,
				toolName: event.name,
				args: event.args,
			};
		case "citation":
			return {
				type: "citation",
				urls: event.urls,
				sources: event.sources,
			};
		case "grounding":
			return {
				type: "grounding",
				queries: event.queries,
				chunks: event.chunks,
			};
		case "logprob":
			return {
				type: "token-logprob",
				token: event.token,
				logprob: event.logprob,
				topLogprobs: event.topLogprobs,
			};
		case "finish":
			return { type: "finish", finishReason: event.reason };
		case "error":
			return {
				type: "error",
				message: event.sanitized ?? "An error occurred while processing the stream.",
			};
		default:
			return null;
	}
}

export interface AISDKMappingExampleOptions {
	events?: StreamEvent[];
	write?: (line: string) => void;
}

export function runAISDKMappingExample(options: AISDKMappingExampleOptions = {}): void {
	const events =
		options.events ??
		([
			{ type: "text.delta", text: "Hello" },
			{ type: "text.done", text: "Hello" },
			{ type: "finish", reason: "stop" },
		] as StreamEvent[]);
	const write = options.write ?? ((line: string) => process.stdout.write(`${line}\n`));
	for (const event of events) {
		const part = mapStreamEventToAISDKPart(event);
		if (part === null) continue;
		const parts = Array.isArray(part) ? part : [part];
		for (const mapped of parts) {
			write(JSON.stringify(mapped));
		}
	}
}
