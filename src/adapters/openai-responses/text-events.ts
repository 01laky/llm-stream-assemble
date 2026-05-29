import type { RawChunk } from "../../core/types";
import { logprobChunksFromResponsesLogprobs } from "../common/logprobs";
import { asString } from "../utils";
import { choiceIndexFromOutputIndex, textChunk } from "./common";
import type { ResponsesParserContext } from "./types";

export function textDeltaChunks(
	context: ResponsesParserContext,
	payload: Record<string, unknown>,
): RawChunk[] {
	const chunks = logprobChunksFromResponsesLogprobs(
		payload.logprobs,
		"content",
		choiceIndexFromOutputIndex(payload.output_index),
		context.logprobPositions,
	);
	const text = asString(payload.delta) ?? asString(payload.text);
	if (!text) return chunks;
	context.textSeen = true;
	const chunk = textChunk(text, context.options);
	if (chunk) chunks.push(chunk);
	return chunks;
}

export function textDoneChunks(
	context: ResponsesParserContext,
	payload: Record<string, unknown>,
): RawChunk[] {
	const chunks: RawChunk[] = [];
	if (!context.textSeen) {
		chunks.push(
			...logprobChunksFromResponsesLogprobs(
				payload.logprobs,
				"content",
				choiceIndexFromOutputIndex(payload.output_index),
				context.logprobPositions,
			),
		);
	}
	if (context.textSeen) return chunks;
	const text = asString(payload.text) ?? asString(payload.delta);
	if (!text) return chunks;
	context.textSeen = true;
	const chunk = textChunk(text, context.options);
	if (chunk) chunks.push(chunk);
	return chunks;
}

export function refusalDeltaChunks(
	context: ResponsesParserContext,
	payload: Record<string, unknown>,
): RawChunk[] {
	const chunks = logprobChunksFromResponsesLogprobs(
		payload.logprobs,
		"refusal",
		choiceIndexFromOutputIndex(payload.output_index),
		context.logprobPositions,
	);
	const text = asString(payload.delta) ?? asString(payload.refusal) ?? asString(payload.text);
	if (text) chunks.push({ kind: "refusal-delta", text });
	return chunks;
}
