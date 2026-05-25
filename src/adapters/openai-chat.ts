import type { FinishReason, RawChunk, StreamAdapter } from "../core/types";

export interface OpenAIChatAdapterOptions {
	jsonMode?: boolean;
	legacyFunctionIdPrefix?: string;
}

interface ToolState {
	id?: string;
	name: string;
	startEmitted: boolean;
	sawArguments: boolean;
}

const DEFAULT_LEGACY_FUNCTION_ID_PREFIX = "legacy_function";

export function openaiChatAdapter(options: OpenAIChatAdapterOptions = {}): StreamAdapter {
	const parser = new OpenAIChatParser(options);
	return {
		parseChunk(raw) {
			return parser.parseChunk(raw);
		},
		parseResponse(body) {
			return parseResponse(body, options);
		},
	};
}

class OpenAIChatParser {
	private metadataEmitted = false;
	private readonly tools = new Map<string, ToolState>();
	private readonly legacyStarted = new Set<number>();

	constructor(private readonly options: OpenAIChatAdapterOptions) {}

	parseChunk(raw: string): RawChunk[] {
		if (raw.trim() === "[DONE]") return [];

		const payload = parseJson(raw, "openaiChatAdapter.parseChunk");
		if (!isRecord(payload)) {
			throw prefixedAdapterError("openaiChatAdapter.parseChunk expected a JSON object");
		}

		if (isRecord(payload.error)) {
			return providerErrorChunks(payload.error, false);
		}

		const chunks: RawChunk[] = [];
		if (!this.metadataEmitted && hasMetadata(payload)) {
			chunks.push(...metadataChunks(payload));
			this.metadataEmitted = true;
		}

		const usage = usageChunk(payload.usage);
		if (usage) chunks.push(usage);

		const choices = Array.isArray(payload.choices) ? payload.choices : [];
		for (let position = 0; position < choices.length; position += 1) {
			const choice = choices[position];
			if (!isRecord(choice)) continue;
			chunks.push(...this.choiceChunks(choice, position));
		}

		return chunks;
	}

	private choiceChunks(choice: Record<string, unknown>, position: number): RawChunk[] {
		const choiceIndex = asNumber(choice.index) ?? position;
		const chunks: RawChunk[] = [];
		const delta = isRecord(choice.delta) ? choice.delta : undefined;

		if (delta) {
			chunks.push(...this.deltaChunks(delta, choiceIndex));
		}

		chunks.push(...finishReasonChunks(choice.finish_reason, choiceIndex));
		return chunks;
	}

	private deltaChunks(delta: Record<string, unknown>, choiceIndex: number): RawChunk[] {
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

		chunks.push(...reasoningChunks(delta));
		chunks.push(...this.toolCallChunks(delta.tool_calls, choiceIndex));
		chunks.push(...this.legacyFunctionChunks(delta.function_call, choiceIndex));
		return chunks;
	}

	private toolCallChunks(value: unknown, choiceIndex: number): RawChunk[] {
		if (!Array.isArray(value)) return [];
		const chunks: RawChunk[] = [];

		for (let position = 0; position < value.length; position += 1) {
			const toolCall = value[position];
			if (!isRecord(toolCall)) continue;

			const toolIndex = asNumber(toolCall.index) ?? position;
			const key = toolKey(choiceIndex, toolIndex);
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

	private legacyFunctionChunks(value: unknown, choiceIndex: number): RawChunk[] {
		if (!isRecord(value)) return [];
		const chunks: RawChunk[] = [];
		const name = asString(value.name);
		const args = asString(value.arguments);
		const id = `${this.options.legacyFunctionIdPrefix ?? DEFAULT_LEGACY_FUNCTION_ID_PREFIX}:${choiceIndex}`;

		if (name && !this.legacyStarted.has(choiceIndex)) {
			chunks.push(withChoiceIndex({ kind: "tool-start", id, name, index: 0 }, choiceIndex));
			this.legacyStarted.add(choiceIndex);
		}

		if (args && args.length > 0) {
			if (!this.legacyStarted.has(choiceIndex)) {
				chunks.push(
					withChoiceIndex(
						{ kind: "tool-start", id, name: name ?? "unknown", index: 0 },
						choiceIndex,
					),
				);
				this.legacyStarted.add(choiceIndex);
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

function parseResponse(body: unknown, options: OpenAIChatAdapterOptions): RawChunk[] {
	if (!isRecord(body)) {
		throw prefixedAdapterError(
			"openaiChatAdapter.parseResponse expected an OpenAI chat completion object",
		);
	}

	if (isRecord(body.error)) {
		return providerErrorChunks(body.error, false);
	}

	if (!hasMetadata(body) && !Array.isArray(body.choices) && body.usage === undefined) {
		throw prefixedAdapterError(
			"openaiChatAdapter.parseResponse expected an OpenAI chat completion object",
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
		finishChunks.push(...responseChoiceFinishChunks(choice, position));
	}

	const usage = usageChunk(body.usage);
	if (usage) chunks.push(usage);
	chunks.push(...finishChunks);
	return chunks;
}

function responseChoiceChunks(
	choice: Record<string, unknown>,
	position: number,
	options: OpenAIChatAdapterOptions,
): RawChunk[] {
	const choiceIndex = asNumber(choice.index) ?? position;
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

		chunks.push(...reasoningChunks(message));
		chunks.push(...responseToolCallChunks(message.tool_calls, choiceIndex));
		chunks.push(...responseLegacyFunctionChunks(message.function_call, choiceIndex, options));
	}

	return chunks;
}

function responseChoiceFinishChunks(choice: Record<string, unknown>, position: number): RawChunk[] {
	const choiceIndex = asNumber(choice.index) ?? position;
	return finishReasonChunks(choice.finish_reason, choiceIndex);
}

function responseToolCallChunks(value: unknown, choiceIndex: number): RawChunk[] {
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
	choiceIndex: number,
	options: OpenAIChatAdapterOptions,
): RawChunk[] {
	if (!isRecord(value)) return [];
	const name = asString(value.name) ?? "unknown";
	const args = asString(value.arguments) ?? "";
	const id = `${options.legacyFunctionIdPrefix ?? DEFAULT_LEGACY_FUNCTION_ID_PREFIX}:${choiceIndex}`;
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

function reasoningChunks(source: Record<string, unknown>): RawChunk[] {
	const chunks: RawChunk[] = [];
	const reasoning = asString(source.reasoning);
	const reasoningContent = asString(source.reasoning_content);
	const reasoningSummary = asString(source.reasoning_summary);
	if (reasoning) chunks.push({ kind: "reasoning-delta", text: reasoning, variant: "detail" });
	if (reasoningContent)
		chunks.push({ kind: "reasoning-delta", text: reasoningContent, variant: "detail" });
	if (reasoningSummary)
		chunks.push({ kind: "reasoning-delta", text: reasoningSummary, variant: "summary" });
	return chunks;
}

function finishReasonChunks(value: unknown, choiceIndex: number): RawChunk[] {
	if (value === null || value === undefined) return [];
	const finishReason = normalizeFinishReason(value);
	if (finishReason) {
		return [withChoiceIndex({ kind: "finish", reason: finishReason }, choiceIndex)];
	}
	return [
		{
			kind: "provider-error",
			error: prefixedAdapterError(`unknown OpenAI finish_reason: ${String(value)}`),
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

function usageChunk(value: unknown): RawChunk | undefined {
	if (!isRecord(value)) return undefined;
	const inputTokens = asNumber(value.prompt_tokens);
	const outputTokens = asNumber(value.completion_tokens);
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

function providerErrorChunks(
	errorPayload: Record<string, unknown>,
	recoverable: boolean,
): RawChunk[] {
	return [
		{ kind: "provider-error", error: errorFromPayload(errorPayload), recoverable },
		{ kind: "finish", reason: "error" },
	];
}

function errorFromPayload(errorPayload: Record<string, unknown>): Error {
	const message = asString(errorPayload.message) ?? "OpenAI provider error";
	const error = prefixedAdapterError(message);
	Object.defineProperty(error, "raw", {
		value: errorPayload,
		enumerable: false,
	});
	return error;
}

function parseJson(raw: string, feature: string): unknown {
	try {
		return JSON.parse(raw) as unknown;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw prefixedAdapterError(`${feature}: ${message}`);
	}
}

function toolStartChunk(input: {
	id: string | undefined;
	name: string;
	index: number;
	choiceIndex: number;
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
	choiceIndex: number;
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
	choiceIndex: number;
}): RawChunk {
	return withOptionalFields({
		kind: "tool-done",
		id: input.id,
		index: input.index,
		choiceIndex: input.choiceIndex,
	});
}

function withChoiceIndex<T extends RawChunk>(chunk: T, choiceIndex: number): T {
	if (choiceIndex === undefined) return chunk;
	return withOptionalFields({ ...chunk, choiceIndex }) as T;
}

function withOptionalFields(input: Record<string, unknown>): RawChunk {
	return Object.fromEntries(
		Object.entries(input).filter(([, value]) => value !== undefined),
	) as RawChunk;
}

function toolKey(choiceIndex: number, toolIndex: number): string {
	return `${choiceIndex}:${toolIndex}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
	return typeof value === "string" ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function prefixedAdapterError(message: string): Error {
	return new Error(`llm-stream-assemble: ${message}`);
}
