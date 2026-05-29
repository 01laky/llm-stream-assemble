import type { FinishReason, RawChunk } from "../../../core/types";
import { asNumber, asString, isRecord, optionalRawChunk } from "../../utils";
import { adapterScopedError } from "../../errors";
import {
	metadataPayloadWithoutCitationFields,
	perplexityCitationFromPayload,
	type CitationGroundingOptions,
} from "../../common/citation-grounding";
import type { RequiredOpenAIChatLikeParserOptions } from "./types";

export function metadataChunks(
	payload: Record<string, unknown>,
	_options: CitationGroundingOptions = {},
): RawChunk[] {
	const chunks: RawChunk[] = [];
	const id = asString(payload.id);
	if (id) chunks.push({ kind: "message-start", id });

	const metadataPayload = metadataPayloadWithoutCitationFields(payload);
	const metadata: Extract<RawChunk, { kind: "metadata" }> = {
		kind: "metadata",
		raw: metadataPayload,
	};
	const model = asString(payload.model);
	const created = asNumber(payload.created);
	if (model) metadata.model = model;
	if (id) metadata.responseId = id;
	if (created !== undefined) metadata.created = created;
	if (metadata.model || metadata.responseId || metadata.created !== undefined) {
		chunks.push(metadata);
	}
	return chunks;
}

export function citationChunksFromRootPayload(
	payload: Record<string, unknown>,
	options: CitationGroundingOptions = {},
): RawChunk[] {
	return perplexityCitationFromPayload(payload, options);
}

export function hasRootCitationFields(payload: Record<string, unknown>): boolean {
	const citations = payload.citations;
	const searchResults = payload.search_results;
	return (
		(Array.isArray(citations) && citations.length > 0) ||
		(Array.isArray(searchResults) && searchResults.length > 0)
	);
}

export function hasMetadata(payload: Record<string, unknown>): boolean {
	return (
		asString(payload.id) !== undefined ||
		asString(payload.model) !== undefined ||
		asNumber(payload.created) !== undefined
	);
}

export function isRecognizableResponse(payload: Record<string, unknown>): boolean {
	return (
		hasMetadata(payload) ||
		typeof payload.object === "string" ||
		Array.isArray(payload.choices) ||
		isRecord(payload.usage)
	);
}

export function reasoningChunks(
	source: Record<string, unknown>,
	options: RequiredOpenAIChatLikeParserOptions,
): RawChunk[] {
	const chunks: RawChunk[] = [];
	const aliases = new Set([
		"reasoning",
		"reasoning_content",
		"reasoning_summary",
		...options.reasoningFieldAliases,
	]);
	for (const field of aliases) {
		const text = asString(source[field]);
		if (!text) continue;
		chunks.push({
			kind: "reasoning-delta",
			text,
			variant: field === "reasoning_summary" ? "summary" : "detail",
		});
	}
	return chunks;
}

export function finishReasonChunks(
	value: unknown,
	choiceIndex: number | undefined,
	options: RequiredOpenAIChatLikeParserOptions,
): RawChunk[] {
	if (value === null || value === undefined) return [];
	const finishReason = normalizeFinishReason(value);
	if (finishReason) {
		return [withChoiceIndex({ kind: "finish", reason: finishReason }, choiceIndex)];
	}
	return [
		{
			kind: "provider-error",
			error: adapterScopedError(
				options.errorPrefix,
				`unknown OpenAI-compatible finish_reason: ${String(value)}`,
			),
			recoverable: true,
		},
		withChoiceIndex({ kind: "finish", reason: "error" }, choiceIndex),
	];
}

export function usageChunk(
	value: unknown,
	options: RequiredOpenAIChatLikeParserOptions,
): RawChunk | undefined {
	if (!isRecord(value)) return undefined;
	const inputTokens = firstNumber(value, options.usageInputTokenFields);
	const outputTokens = firstNumber(value, options.usageOutputTokenFields);
	const details = isRecord(value.completion_tokens_details)
		? value.completion_tokens_details
		: undefined;
	const reasoningTokens = details ? asNumber(details.reasoning_tokens) : undefined;
	if (inputTokens === undefined && outputTokens === undefined && reasoningTokens === undefined) {
		return undefined;
	}
	const chunk: Extract<RawChunk, { kind: "usage" }> = { kind: "usage", raw: value };
	if (inputTokens !== undefined) chunk.inputTokens = inputTokens;
	if (outputTokens !== undefined) chunk.outputTokens = outputTokens;
	if (reasoningTokens !== undefined) chunk.reasoningTokens = reasoningTokens;
	return chunk;
}

export function choiceIndexFor(
	choice: Record<string, unknown>,
	position: number,
	options: RequiredOpenAIChatLikeParserOptions,
): number | undefined {
	return asNumber(choice.index) ?? (options.useChoicePositionFallback ? position : undefined);
}

export function toolStartChunk(input: {
	id: string | undefined;
	name: string;
	index: number;
	choiceIndex: number | undefined;
}): RawChunk {
	return optionalRawChunk({
		kind: "tool-start",
		id: input.id,
		name: input.name,
		index: input.index,
		choiceIndex: input.choiceIndex,
	});
}

export function toolArgsChunk(input: {
	id: string | undefined;
	delta: string;
	index: number;
	choiceIndex: number | undefined;
}): RawChunk {
	return optionalRawChunk({
		kind: "tool-args-delta",
		id: input.id,
		delta: input.delta,
		index: input.index,
		choiceIndex: input.choiceIndex,
	});
}

export function toolDoneChunk(input: {
	id: string | undefined;
	index: number;
	choiceIndex: number | undefined;
}): RawChunk {
	return optionalRawChunk({
		kind: "tool-done",
		id: input.id,
		index: input.index,
		choiceIndex: input.choiceIndex,
	});
}

export function withChoiceIndex<T extends RawChunk>(chunk: T, choiceIndex: number | undefined): T {
	if (choiceIndex === undefined) return chunk;
	return optionalRawChunk({ ...chunk, choiceIndex }) as T;
}

export function toolKey(
	choiceIndex: number | undefined,
	choicePosition: number,
	toolIndex: number,
): string {
	return `${choiceKey(choiceIndex, choicePosition)}:${toolIndex}`;
}

export function choiceKey(choiceIndex: number | undefined, choicePosition: number): string {
	return choiceIndex === undefined ? `unknown-choice:${choicePosition}` : String(choiceIndex);
}

function normalizeFinishReason(value: unknown): FinishReason | undefined {
	if (
		value === "stop" ||
		value === "length" ||
		value === "content_filter" ||
		value === "tool_calls"
	) {
		return value;
	}
	if (value === "function_call") return "tool_calls";
	return undefined;
}

function firstNumber(source: Record<string, unknown>, fields: string[]): number | undefined {
	for (const field of fields) {
		const value = asNumber(source[field]);
		if (value !== undefined) return value;
	}
	return undefined;
}
