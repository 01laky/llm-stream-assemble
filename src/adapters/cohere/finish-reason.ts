import type { FinishReason } from "../../core/types";

export function mapCohereFinishReason(value: string): FinishReason {
	const normalized = value.toUpperCase();
	switch (normalized) {
		case "COMPLETE":
		case "STOP_SEQUENCE":
			return "stop";
		case "MAX_TOKENS":
			return "length";
		case "TOOL_CALL":
			return "tool_calls";
		case "ERROR":
		case "TIMEOUT":
			return "error";
		default:
			if (normalized.includes("FILTER") || normalized.includes("SAFETY")) {
				return "content_filter";
			}
			return "stop";
	}
}
