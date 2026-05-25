import type { FinishReason, RawChunk, StreamAdapter } from "../../core/types";
import { asNumber, asString, isRecord, parseAdapterJSON } from "../utils";

export interface OpenAIChatLikeParserOptions {
	jsonMode?: boolean;
	legacyFunctionIdPrefix?: string;
	errorPrefix: "openaiChatAdapter" | "openaiCompatibleAdapter";
	looseErrorShape?: boolean;
	allowMissingMetadata?: boolean;
	useChoicePositionFallback?: boolean;
	reasoningFieldAliases?: string[];
	usageInputTokenFields?: string[];
	usageOutputTokenFields?: string[];
	rejectUnrecognizedPayloads?: boolean;
}

interface ToolState {
	id?: string;
	name: string;
	startEmitted: boolean;
	sawArguments: boolean;
}

export function createOpenAIChatLikeAdapter(options: OpenAIChatLikeParserOptions): StreamAdapter {
	const parser = new OpenAIChatLikeParser(normalizeOptions(options));
	return {
		parseChunk(raw) {
			return parser.parseChunk(raw);
		},
		parseResponse(body) {
			return parseResponse(body, normalizeOptions(options));
		},
	};
}

class OpenAIChatLikeParser {
	private metadataEmitted = false;
	private readonly tools = new Map<string, ToolState>();
	private readonly legacyStarted = new Set<string>();

	constructor(private readonly options: RequiredOpenAIChatLikeParserOptions) {}

	parseChunk(raw: string): RawChunk[] {
		if (raw.trim() === "[DONE]") return [];

		const payload = parseAdapterJSON(raw, `${this.options.errorPrefix}.parseChunk`);
		if (!isRecord(payload)) {
			throw prefixedAdapterError(
				"expected a JSON object",
				`${this.options.errorPrefix}.parseChunk`,
			);
		}

		const looseError = providerErrorPayload(payload, this.options);
		if (looseError) return providerErrorChunks(looseError, false, this.options);

		if (this.options.rejectUnrecognizedPayloads && !this.isRecognizableChunk(payload)) {
			throw prefixedAdapterError(
				"expected an OpenAI-compatible chat completion chunk",
				`${this.options.errorPrefix}.parseChunk`,
			);
		}

		const chunks: RawChunk[] = [];
		if (!this.metadataEmitted && hasMetadata(payload)) {
			chunks.push(...metadataChunks(payload));
			this.metadataEmitted = true;
		}

		const usage = usageChunk(payload.usage, this.options);
		if (usage) chunks.push(usage);

		const choices = Array.isArray(payload.choices) ? payload.choices : [];
		for (let position = 0; position < choices.length; position += 1) {
			const choice = choices[position];
			if (!isRecord(choice)) continue;
			chunks.push(...this.choiceChunks(choice, position));
		}

		return chunks;
	}

	private isRecognizableChunk(payload: Record<string, unknown>): boolean {
		return (
			hasMetadata(payload) ||
			typeof payload.object === "string" ||
			Array.isArray(payload.choices) ||
			isRecord(payload.usage)
		);
	}

	private choiceChunks(choice: Record<string, unknown>, position: number): RawChunk[] {
		const choiceIndex = choiceIndexFor(choice, position, this.options);
		const chunks: RawChunk[] = [];
		const delta = isRecord(choice.delta) ? choice.delta : undefined;

		if (delta) {
			chunks.push(...this.deltaChunks(delta, choiceIndex, position));
		}

		chunks.push(...finishReasonChunks(choice.finish_reason, choiceIndex, this.options));
		return chunks;
	}

	private deltaChunks(
		delta: Record<string, unknown>,
		choiceIndex: number | undefined,
		choicePosition: number,
	): RawChunk[] {
		const chunks: RawChunk[] = [];
		const content = asString(delta.content);
		if (content && content.length > 0) {
			chunks.push(
				this.options.jsonMode
					? { kind: "json-delta", delta: content }
					: withChoiceIndex({ kind: "text-delta", text: content }, choiceIndex),
			);
		}

		const refusal = asString(delta.refusal);
		if (refusal && refusal.length > 0) {
			chunks.push({ kind: "refusal-delta", text: refusal });
		}

		chunks.push(...reasoningChunks(delta, this.options));
		chunks.push(...this.toolCallChunks(delta.tool_calls, choiceIndex, choicePosition));
		chunks.push(...this.legacyFunctionChunks(delta.function_call, choiceIndex, choicePosition));
		return chunks;
	}

	private toolCallChunks(
		value: unknown,
		choiceIndex: number | undefined,
		choicePosition: number,
	): RawChunk[] {
		if (!Array.isArray(value)) return [];
		const chunks: RawChunk[] = [];

		for (let position = 0; position < value.length; position += 1) {
			const toolCall = value[position];
			if (!isRecord(toolCall)) continue;

			const toolIndex = asNumber(toolCall.index) ?? position;
			const key = toolKey(choiceIndex, choicePosition, toolIndex);
			const state = this.toolState(key);
			const id = asString(toolCall.id);
			const fn = isRecord(toolCall.function) ? toolCall.function : undefined;
			const name = asString(fn?.name);
			const args = asString(fn?.arguments);

			if (id) state.id = id;
			if (name) state.name = name;

			if (!state.startEmitted && (id || name || (args && args.length > 0))) {
				chunks.push(
					toolStartChunk({
						id: state.id,
						name: state.name,
						index: toolIndex,
						choiceIndex,
					}),
				);
				state.startEmitted = true;
			}

			if (args && args.length > 0) {
				state.sawArguments = true;
				chunks.push(
					toolArgsChunk({
						id: state.id,
						delta: args,
						index: toolIndex,
						choiceIndex,
					}),
				);
			}
		}

		return chunks;
	}

	private legacyFunctionChunks(
		value: unknown,
		choiceIndex: number | undefined,
		choicePosition: number,
	): RawChunk[] {
		if (!isRecord(value)) return [];
		const chunks: RawChunk[] = [];
		const name = asString(value.name);
		const args = asString(value.arguments);
		const legacyKey = choiceKey(choiceIndex, choicePosition);
		const id = `${this.options.legacyFunctionIdPrefix}:${choiceIndex ?? choicePosition}`;

		if (name && !this.legacyStarted.has(legacyKey)) {
			chunks.push(withChoiceIndex({ kind: "tool-start", id, name, index: 0 }, choiceIndex));
			this.legacyStarted.add(legacyKey);
		}

		if (args && args.length > 0) {
			if (!this.legacyStarted.has(legacyKey)) {
				chunks.push(
					withChoiceIndex(
						{ kind: "tool-start", id, name: name ?? "unknown", index: 0 },
						choiceIndex,
					),
				);
				this.legacyStarted.add(legacyKey);
			}
			chunks.push(
				withChoiceIndex({ kind: "tool-args-delta", id, delta: args, index: 0 }, choiceIndex),
			);
		}

		return chunks;
	}

	private toolState(key: string): ToolState {
		let state = this.tools.get(key);
		if (!state) {
			state = { name: "unknown", startEmitted: false, sawArguments: false };
			this.tools.set(key, state);
		}
		return state;
	}
}

function parseResponse(body: unknown, options: RequiredOpenAIChatLikeParserOptions): RawChunk[] {
	if (!isRecord(body)) {
		throw prefixedAdapterError(
			"expected an OpenAI-compatible chat completion object",
			`${options.errorPrefix}.parseResponse`,
		);
	}

	const looseError = providerErrorPayload(body, options);
	if (looseError) return providerErrorChunks(looseError, false, options);

	if (options.rejectUnrecognizedPayloads && !isRecognizableResponse(body)) {
		throw prefixedAdapterError(
			"expected an OpenAI-compatible chat completion object",
			`${options.errorPrefix}.parseResponse`,
		);
	}

	const chunks: RawChunk[] = [];
	const finishChunks: RawChunk[] = [];
	chunks.push(...metadataChunks(body));

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

function metadataChunks(payload: Record<string, unknown>): RawChunk[] {
	const chunks: RawChunk[] = [];
	const id = asString(payload.id);
	if (id) chunks.push({ kind: "message-start", id });

	const metadata: Extract<RawChunk, { kind: "metadata" }> = { kind: "metadata", raw: payload };
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

function hasMetadata(payload: Record<string, unknown>): boolean {
	return (
		asString(payload.id) !== undefined ||
		asString(payload.model) !== undefined ||
		asNumber(payload.created) !== undefined
	);
}

function isRecognizableResponse(payload: Record<string, unknown>): boolean {
	return (
		hasMetadata(payload) ||
		typeof payload.object === "string" ||
		Array.isArray(payload.choices) ||
		isRecord(payload.usage)
	);
}

function reasoningChunks(
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

function finishReasonChunks(
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
			error: prefixedAdapterError(
				`unknown OpenAI-compatible finish_reason: ${String(value)}`,
				options.errorPrefix,
			),
			recoverable: true,
		},
		withChoiceIndex({ kind: "finish", reason: "error" }, choiceIndex),
	];
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

function usageChunk(
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

function providerErrorPayload(
	payload: Record<string, unknown>,
	options: RequiredOpenAIChatLikeParserOptions,
): Record<string, unknown> | undefined {
	if (isRecord(payload.error)) return payload.error;
	if (!options.looseErrorShape) return undefined;

	const errorString = asString(payload.error);
	if (errorString) return { message: errorString };

	const detailString = asString(payload.detail);
	if (detailString) return { message: detailString };
	if (isRecord(payload.detail)) return payload.detail;

	const topLevelMessage = asString(payload.message);
	const topLevelType = asString(payload.type);
	if (topLevelMessage && topLevelType === "error") return { message: topLevelMessage };

	return undefined;
}

function providerErrorChunks(
	errorPayload: Record<string, unknown>,
	recoverable: boolean,
	options: RequiredOpenAIChatLikeParserOptions,
): RawChunk[] {
	return [
		{ kind: "provider-error", error: errorFromPayload(errorPayload, options), recoverable },
		{ kind: "finish", reason: "error" },
	];
}

function errorFromPayload(
	errorPayload: Record<string, unknown>,
	options: RequiredOpenAIChatLikeParserOptions,
): Error {
	const message = asString(errorPayload.message) ?? "OpenAI-compatible provider error";
	const error = prefixedAdapterError(message, options.errorPrefix);
	Object.defineProperty(error, "raw", {
		value: errorPayload,
		enumerable: false,
	});
	return error;
}

function choiceIndexFor(
	choice: Record<string, unknown>,
	position: number,
	options: RequiredOpenAIChatLikeParserOptions,
): number | undefined {
	return asNumber(choice.index) ?? (options.useChoicePositionFallback ? position : undefined);
}

function toolStartChunk(input: {
	id: string | undefined;
	name: string;
	index: number;
	choiceIndex: number | undefined;
}): RawChunk {
	return withOptionalFields({
		kind: "tool-start",
		id: input.id,
		name: input.name,
		index: input.index,
		choiceIndex: input.choiceIndex,
	});
}

function toolArgsChunk(input: {
	id: string | undefined;
	delta: string;
	index: number;
	choiceIndex: number | undefined;
}): RawChunk {
	return withOptionalFields({
		kind: "tool-args-delta",
		id: input.id,
		delta: input.delta,
		index: input.index,
		choiceIndex: input.choiceIndex,
	});
}

function toolDoneChunk(input: {
	id: string | undefined;
	index: number;
	choiceIndex: number | undefined;
}): RawChunk {
	return withOptionalFields({
		kind: "tool-done",
		id: input.id,
		index: input.index,
		choiceIndex: input.choiceIndex,
	});
}

function withChoiceIndex<T extends RawChunk>(chunk: T, choiceIndex: number | undefined): T {
	if (choiceIndex === undefined) return chunk;
	return withOptionalFields({ ...chunk, choiceIndex }) as T;
}

function withOptionalFields(input: Record<string, unknown>): RawChunk {
	return Object.fromEntries(
		Object.entries(input).filter(([, value]) => value !== undefined),
	) as RawChunk;
}

function toolKey(
	choiceIndex: number | undefined,
	choicePosition: number,
	toolIndex: number,
): string {
	return `${choiceKey(choiceIndex, choicePosition)}:${toolIndex}`;
}

function choiceKey(choiceIndex: number | undefined, choicePosition: number): string {
	return choiceIndex === undefined ? `unknown-choice:${choicePosition}` : String(choiceIndex);
}

function firstNumber(source: Record<string, unknown>, fields: string[]): number | undefined {
	for (const field of fields) {
		const value = asNumber(source[field]);
		if (value !== undefined) return value;
	}
	return undefined;
}

function prefixedAdapterError(message: string, prefix: string): Error {
	return new Error(`llm-stream-assemble: ${prefix}: ${message}`);
}

interface RequiredOpenAIChatLikeParserOptions {
	jsonMode: boolean;
	legacyFunctionIdPrefix: string;
	errorPrefix: "openaiChatAdapter" | "openaiCompatibleAdapter";
	looseErrorShape: boolean;
	allowMissingMetadata: boolean;
	useChoicePositionFallback: boolean;
	reasoningFieldAliases: string[];
	usageInputTokenFields: string[];
	usageOutputTokenFields: string[];
	rejectUnrecognizedPayloads: boolean;
}

function normalizeOptions(
	options: OpenAIChatLikeParserOptions,
): RequiredOpenAIChatLikeParserOptions {
	return {
		jsonMode: options.jsonMode ?? false,
		legacyFunctionIdPrefix: options.legacyFunctionIdPrefix ?? "legacy_function",
		errorPrefix: options.errorPrefix,
		looseErrorShape: options.looseErrorShape ?? false,
		allowMissingMetadata: options.allowMissingMetadata ?? false,
		useChoicePositionFallback: options.useChoicePositionFallback ?? true,
		reasoningFieldAliases: options.reasoningFieldAliases ?? [],
		usageInputTokenFields: options.usageInputTokenFields ?? ["prompt_tokens"],
		usageOutputTokenFields: options.usageOutputTokenFields ?? ["completion_tokens"],
		rejectUnrecognizedPayloads: options.rejectUnrecognizedPayloads ?? false,
	};
}
