import type { RawChunk } from "../../../core/types";
import { asNumber, asString, isRecord } from "../../utils";
import {
	openAIProviderErrorChunks,
	providerErrorPayload,
	throwAdapterObjectError,
	throwUnrecognizedResponseError,
} from "./errors";
import {
	choiceIndexFor,
	citationChunksFromRootPayload,
	finishReasonChunks,
	isRecognizableResponse,
	metadataChunks,
	reasoningChunks,
	toolArgsChunk,
	toolDoneChunk,
	toolStartChunk,
	usageChunk,
	withChoiceIndex,
} from "./chunks";
import { logprobChunksFromChoiceLogprobs } from "../../common/logprobs";
import type { RequiredOpenAIChatLikeParserOptions } from "./types";

export function parseResponse(
	body: unknown,
	options: RequiredOpenAIChatLikeParserOptions,
): RawChunk[] {
	if (!isRecord(body)) {
		throwAdapterObjectError(
			`${options.errorPrefix}.parseResponse`,
			"expected an OpenAI-compatible chat completion object",
		);
	}

	const looseError = providerErrorPayload(body, options);
	if (looseError) return openAIProviderErrorChunks(looseError, false, options);

	if (options.rejectUnrecognizedPayloads && !isRecognizableResponse(body)) {
		throwUnrecognizedResponseError(options);
	}

	const chunks: RawChunk[] = [];
	const finishChunks: RawChunk[] = [];
	const citationOptions = { emitLegacyCitationMetadata: options.emitLegacyCitationMetadata };
	chunks.push(...metadataChunks(body, citationOptions));
	chunks.push(...citationChunksFromRootPayload(body, citationOptions));

	const choices = Array.isArray(body.choices) ? body.choices : [];
	for (let position = 0; position < choices.length; position += 1) {
		const choice = choices[position];
		if (!isRecord(choice)) continue;
		chunks.push(...responseChoiceChunks(choice, position, options));
		finishChunks.push(...responseChoiceFinishChunks(choice, position, options));
	}

	const usage = usageChunk(body.usage, options);
	if (usage) chunks.push(usage);
	chunks.push(...finishChunks);
	return chunks;
}

function responseChoiceChunks(
	choice: Record<string, unknown>,
	position: number,
	options: RequiredOpenAIChatLikeParserOptions,
): RawChunk[] {
	const choiceIndex = choiceIndexFor(choice, position, options);
	const message = isRecord(choice.message) ? choice.message : undefined;
	const chunks: RawChunk[] = [];

	chunks.push(...logprobChunksFromChoiceLogprobs(choice.logprobs, choiceIndex));

	if (message) {
		const content = asString(message.content);
		if (content && content.length > 0) {
			chunks.push(
				options.jsonMode
					? { kind: "json-delta", delta: content }
					: withChoiceIndex({ kind: "text-delta", text: content }, choiceIndex),
			);
		}

		const refusal = asString(message.refusal);
		if (refusal && refusal.length > 0) {
			chunks.push({ kind: "refusal-delta", text: refusal });
		}

		chunks.push(...reasoningChunks(message, options));
		chunks.push(...responseToolCallChunks(message.tool_calls, choiceIndex));
		chunks.push(
			...responseLegacyFunctionChunks(message.function_call, choiceIndex, position, options),
		);
	}

	return chunks;
}

function responseChoiceFinishChunks(
	choice: Record<string, unknown>,
	position: number,
	options: RequiredOpenAIChatLikeParserOptions,
): RawChunk[] {
	const choiceIndex = choiceIndexFor(choice, position, options);
	return finishReasonChunks(choice.finish_reason, choiceIndex, options);
}

function responseToolCallChunks(value: unknown, choiceIndex: number | undefined): RawChunk[] {
	if (!Array.isArray(value)) return [];
	const chunks: RawChunk[] = [];

	for (let position = 0; position < value.length; position += 1) {
		const toolCall = value[position];
		if (!isRecord(toolCall)) continue;
		const fn = isRecord(toolCall.function) ? toolCall.function : undefined;
		const id = asString(toolCall.id);
		const name = asString(fn?.name) ?? "unknown";
		const args = asString(fn?.arguments) ?? "";
		const index = asNumber(toolCall.index) ?? position;

		chunks.push(toolStartChunk({ id, name, index, choiceIndex }));
		if (args.length > 0) chunks.push(toolArgsChunk({ id, delta: args, index, choiceIndex }));
		chunks.push(toolDoneChunk({ id, index, choiceIndex }));
	}

	return chunks;
}

function responseLegacyFunctionChunks(
	value: unknown,
	choiceIndex: number | undefined,
	choicePosition: number,
	options: RequiredOpenAIChatLikeParserOptions,
): RawChunk[] {
	if (!isRecord(value)) return [];
	const name = asString(value.name) ?? "unknown";
	const args = asString(value.arguments) ?? "";
	const id = `${options.legacyFunctionIdPrefix}:${choiceIndex ?? choicePosition}`;
	const chunks: RawChunk[] = [
		withChoiceIndex({ kind: "tool-start", id, name, index: 0 }, choiceIndex),
	];
	if (args.length > 0) {
		chunks.push(
			withChoiceIndex({ kind: "tool-args-delta", id, delta: args, index: 0 }, choiceIndex),
		);
	}
	chunks.push(withChoiceIndex({ kind: "tool-done", id, index: 0 }, choiceIndex));
	return chunks;
}
