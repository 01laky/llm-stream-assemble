import type { FinishReason } from "../../core/types";

/** Anthropic Messages and Bedrock Converse share similar stop-reason strings. */
export function mapAnthropicLikeStopReason(value: string): FinishReason {
	switch (value) {
		case "end_turn":
		case "stop_sequence":
			return "stop";
		case "tool_use":
			return "tool_calls";
		case "max_tokens":
			return "length";
		case "content_filtered":
		case "guardrail_intervened":
		case "refusal":
			return "content_filter";
		default:
			return "stop";
	}
}
