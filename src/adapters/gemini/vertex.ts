import { isRecord } from "../utils";

/** Strip Vertex / gateway wrappers before mapping GenerateContentResponse fields. */
export function normalizeVertexChunk(
	payload: Record<string, unknown>,
): Record<string, unknown> | null {
	if (isRecord(payload.response)) {
		return payload.response;
	}
	if (isRecord(payload.result)) {
		return payload.result;
	}
	if (Array.isArray(payload.predictions)) {
		const first = payload.predictions[0];
		if (isRecord(first)) return first;
	}
	if (
		payload.candidates !== undefined ||
		payload.usageMetadata !== undefined ||
		payload.promptFeedback !== undefined ||
		payload.responseId !== undefined ||
		isRecord(payload.error)
	) {
		return payload;
	}
	return null;
}
