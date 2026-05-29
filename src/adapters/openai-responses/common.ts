import type { RawChunk } from "../../core/types";
import { logprobChunksFromResponsesLogprobs, type LogprobPositionState } from "../common/logprobs";
import { textOrJsonDelta } from "../common/text-delta";
import { providerErrorChunksFromMessage } from "../errors";
import { asNumber, asString, isRecord, optionalRawChunk } from "../utils";
import type { OpenAIResponsesAdapterOptions } from "./types";

export function choiceIndexFromOutputIndex(outputIndex: unknown): number | undefined {
	const index = asNumber(outputIndex);
	if (index === undefined || index === 0) return undefined;
	return index;
}

export function metadataChunks(response: Record<string, unknown>): RawChunk[] {
	const id = asString(response.id);
	const chunks: RawChunk[] = [];
	if (id) chunks.push({ kind: "message-start", id });
	const metadata = optionalRawChunk({
		kind: "metadata",
		responseId: id,
		model: asString(response.model),
		created: asNumber(response.created_at),
		raw: response,
	});
	if (metadata.kind === "metadata" && (metadata.responseId || metadata.model || metadata.created)) {
		chunks.push(metadata);
	}
	return chunks;
}

export function hasResponseMetadata(response: Record<string, unknown>): boolean {
	return (
		asString(response.id) !== undefined ||
		asString(response.model) !== undefined ||
		asNumber(response.created_at) !== undefined
	);
}

export function messageItemChunks(
	item: Record<string, unknown>,
	options: OpenAIResponsesAdapterOptions,
	positionState?: LogprobPositionState,
	outputIndex?: number,
): RawChunk[] {
	const chunks: RawChunk[] = [];
	const choiceIndex = choiceIndexFromOutputIndex(outputIndex);
	const content = Array.isArray(item.content) ? item.content : [];
	for (const part of content) {
		if (!isRecord(part)) continue;
		const type = asString(part.type);
		const channel = type === "refusal" ? "refusal" : "content";
		chunks.push(
			...logprobChunksFromResponsesLogprobs(part.logprobs, channel, choiceIndex, positionState),
		);
		const text = asString(part.text) ?? asString(part.delta);
		const refusal = asString(part.refusal);
		if (type === "output_text" && text) chunks.push(textChunk(text, options));
		if (type === "refusal" && (refusal || text))
			chunks.push({ kind: "refusal-delta", text: refusal ?? text ?? "" });
	}
	const directText = asString(item.text);
	if (directText) chunks.push(textChunk(directText, options));
	chunks.push(...reasoningChunks(item));
	return chunks;
}

export function reasoningChunks(payload: Record<string, unknown>): RawChunk[] {
	const chunks: RawChunk[] = [];
	for (const field of ["reasoning", "reasoning_text", "summary"]) {
		const text = asString(payload[field]);
		if (text)
			chunks.push({
				kind: "reasoning-delta",
				text,
				variant: field === "summary" ? "summary" : "detail",
			});
	}
	return chunks;
}

export function usageFromResponse(response: Record<string, unknown>): RawChunk[] {
	const usage = isRecord(response.usage) ? response.usage : undefined;
	if (!usage) return [];
	const inputTokens = asNumber(usage.input_tokens);
	const outputTokens = asNumber(usage.output_tokens);
	const details = isRecord(usage.output_tokens_details) ? usage.output_tokens_details : undefined;
	const reasoningTokens = details ? asNumber(details.reasoning_tokens) : undefined;
	if (inputTokens === undefined && outputTokens === undefined && reasoningTokens === undefined)
		return [];
	return [
		optionalRawChunk({
			kind: "usage",
			inputTokens,
			outputTokens,
			reasoningTokens,
			raw: usage,
		}),
	];
}

export function textChunk(text: string, options: OpenAIResponsesAdapterOptions): RawChunk {
	const chunk = textOrJsonDelta(text, { jsonMode: options.jsonMode });
	return chunk ?? { kind: "text-delta", text };
}

export function providerErrorChunks(message: string): RawChunk[] {
	return providerErrorChunksFromMessage(message, false);
}

export function errorMessage(payload: Record<string, unknown>): string {
	const error = isRecord(payload.error) ? payload.error : undefined;
	return (
		asString(error?.message) ??
		asString(payload.message) ??
		asString(payload.error) ??
		"OpenAI Responses provider error"
	);
}

export function isErrorPayload(payload: Record<string, unknown>): boolean {
	return asString(payload.type) === "error" || payload.error !== undefined;
}

export function toolId(payload: Record<string, unknown>, item?: Record<string, unknown>): string {
	const callId = asString(item?.call_id) ?? asString(payload.call_id);
	const itemId = asString(item?.id) ?? asString(payload.item_id);
	const index = asNumber(payload.output_index);
	return callId ?? itemId ?? `response_tool:${index ?? 0}`;
}
