import type { FinishReason, RawChunk, StreamAdapter } from "../core/types";
import { libraryError, providerErrorChunksFromMessage } from "./errors";
import {
	asNumber,
	asString,
	createStreamAdapter,
	isRecord,
	optionalRawChunk,
	parseAdapterJSON,
} from "./utils";

export interface AnthropicAdapterOptions {
	/**
	 * Map `json` content blocks to json-delta instead of text-delta.
	 */
	jsonMode?: boolean;
}

interface BlockState {
	type: string;
	id?: string;
	name?: string;
}

export function anthropicAdapter(options: AnthropicAdapterOptions = {}): StreamAdapter {
	const parser = new AnthropicStreamParser(options);
	return createStreamAdapter({
		parser,
		parseResponse,
		options,
	});
}

class AnthropicStreamParser {
	private readonly blocks = new Map<number, BlockState>();
	private sawFinish = false;

	constructor(private readonly options: AnthropicAdapterOptions) {}

	parseChunk(raw: string): RawChunk[] {
		const payload = parseAdapterJSON(raw, "anthropicAdapter.parseChunk");
		if (!isRecord(payload)) {
			throw libraryError("anthropicAdapter.parseChunk expected a JSON object");
		}

		const type = asString(payload.type);
		switch (type) {
			case "ping":
				return [];
			case "message_start":
				return this.messageStart(payload);
			case "content_block_start":
				return this.contentBlockStart(payload);
			case "content_block_delta":
				return this.contentBlockDelta(payload);
			case "content_block_stop":
				return this.contentBlockStop(payload);
			case "message_delta":
				return this.messageDelta(payload);
			case "message_stop":
				return this.messageStop();
			case "error":
				return providerErrorChunks(payload.error);
			default:
				throw libraryError(`anthropicAdapter.parseChunk unknown event type: ${String(type)}`);
		}
	}

	private messageStart(payload: Record<string, unknown>): RawChunk[] {
		const message = isRecord(payload.message) ? payload.message : undefined;
		if (!message) return [];
		const chunks: RawChunk[] = [];
		const id = asString(message.id);
		const model = asString(message.model);
		if (id) chunks.push({ kind: "message-start", id });
		if (id || model) {
			chunks.push(optionalRawChunk({ kind: "metadata", responseId: id, model, raw: message }));
		}
		const usage = usageChunk(message.usage);
		if (usage) chunks.push(usage);
		return chunks;
	}

	private contentBlockStart(payload: Record<string, unknown>): RawChunk[] {
		const index = asNumber(payload.index) ?? 0;
		const block = isRecord(payload.content_block) ? payload.content_block : undefined;
		if (!block) return [];
		const blockType = asString(block.type) ?? "unknown";
		const state: BlockState = { type: blockType };
		this.blocks.set(index, state);

		switch (blockType) {
			case "text": {
				const text = asString(block.text);
				return text ? [{ kind: "text-delta", text }] : [];
			}
			case "thinking": {
				const text = asString(block.thinking);
				return text ? [{ kind: "reasoning-delta", text, variant: "detail" }] : [];
			}
			case "redacted_thinking":
				return [];
			case "tool_use": {
				const id = asString(block.id);
				const name = asString(block.name) ?? "unknown";
				if (id) state.id = id;
				state.name = name;
				const chunks: RawChunk[] = [optionalRawChunk({ kind: "tool-start", id, name, index })];
				const input = block.input;
				if (input !== undefined && !(isRecord(input) && Object.keys(input).length === 0)) {
					chunks.push(
						optionalRawChunk({ kind: "tool-args-delta", id, delta: JSON.stringify(input), index }),
					);
				}
				return chunks;
			}
			case "json": {
				const text = asString(block.text) ?? asString(block.partial_json);
				return text ? [{ kind: "json-delta", delta: text }] : [];
			}
			case "refusal": {
				const text = asString(block.refusal) ?? asString(block.text);
				return text ? [{ kind: "refusal-delta", text }] : [];
			}
			default:
				return [];
		}
	}

	private contentBlockDelta(payload: Record<string, unknown>): RawChunk[] {
		const index = asNumber(payload.index) ?? 0;
		const delta = isRecord(payload.delta) ? payload.delta : undefined;
		if (!delta) return [];
		const deltaType = asString(delta.type);
		const state = this.blocks.get(index);

		switch (deltaType) {
			case "text_delta": {
				const text = asString(delta.text);
				if (!text) return [];
				if (this.options.jsonMode || state?.type === "json")
					return [{ kind: "json-delta", delta: text }];
				if (state?.type === "refusal") return [{ kind: "refusal-delta", text }];
				return [{ kind: "text-delta", text }];
			}
			case "thinking_delta": {
				const text = asString(delta.thinking);
				return text ? [{ kind: "reasoning-delta", text, variant: "detail" }] : [];
			}
			case "input_json_delta": {
				const partial = asString(delta.partial_json);
				if (!partial) return [];
				return [
					optionalRawChunk({ kind: "tool-args-delta", id: state?.id, delta: partial, index }),
				];
			}
			case "signature_delta":
				return [];
			default:
				return [];
		}
	}

	private contentBlockStop(payload: Record<string, unknown>): RawChunk[] {
		const index = asNumber(payload.index) ?? 0;
		const state = this.blocks.get(index);
		this.blocks.delete(index);
		if (state?.type === "tool_use") {
			return [optionalRawChunk({ kind: "tool-done", id: state.id, index })];
		}
		return [];
	}

	private messageDelta(payload: Record<string, unknown>): RawChunk[] {
		const chunks: RawChunk[] = [];
		const usage = usageChunk(payload.usage);
		if (usage) chunks.push(usage);
		const delta = isRecord(payload.delta) ? payload.delta : undefined;
		const stopReason = delta ? asString(delta.stop_reason) : undefined;
		if (stopReason) {
			const reason = finishReason(stopReason);
			if (reason) chunks.push({ kind: "finish", reason });
			this.sawFinish = true;
		}
		return chunks;
	}

	private messageStop(): RawChunk[] {
		if (this.sawFinish) return [];
		this.sawFinish = true;
		return [{ kind: "finish", reason: "stop" }];
	}
}

function parseResponse(body: unknown, options: AnthropicAdapterOptions): RawChunk[] {
	if (!isRecord(body)) {
		throw libraryError("anthropicAdapter.parseResponse expected an Anthropic message object");
	}
	if (asString(body.type) === "error" || isRecord(body.error)) {
		return providerErrorChunks(body.error);
	}

	const chunks: RawChunk[] = [];
	const id = asString(body.id);
	const model = asString(body.model);
	if (id) chunks.push({ kind: "message-start", id });
	if (id || model)
		chunks.push(optionalRawChunk({ kind: "metadata", responseId: id, model, raw: body }));
	const inputUsage = usageChunk(body.usage);
	if (inputUsage) chunks.push(inputUsage);

	const content = Array.isArray(body.content) ? body.content : [];
	for (let index = 0; index < content.length; index += 1) {
		const block = content[index];
		if (!isRecord(block)) continue;
		chunks.push(...responseBlockChunks(block, index, options));
	}

	const reason = finishReason(asString(body.stop_reason));
	if (reason) chunks.push({ kind: "finish", reason });
	return chunks;
}

function responseBlockChunks(
	block: Record<string, unknown>,
	index: number,
	options: AnthropicAdapterOptions,
): RawChunk[] {
	const type = asString(block.type);
	switch (type) {
		case "text": {
			const text = asString(block.text);
			if (!text) return [];
			return options.jsonMode
				? [{ kind: "json-delta", delta: text }]
				: [{ kind: "text-delta", text }];
		}
		case "thinking": {
			const text = asString(block.thinking);
			return text ? [{ kind: "reasoning-delta", text, variant: "detail" }] : [];
		}
		case "tool_use": {
			const id = asString(block.id);
			const name = asString(block.name) ?? "unknown";
			const chunks: RawChunk[] = [optionalRawChunk({ kind: "tool-start", id, name, index })];
			if (block.input !== undefined) {
				chunks.push(
					optionalRawChunk({
						kind: "tool-args-delta",
						id,
						delta: JSON.stringify(block.input),
						index,
					}),
				);
			}
			chunks.push(optionalRawChunk({ kind: "tool-done", id, index }));
			return chunks;
		}
		case "refusal": {
			const text = asString(block.refusal) ?? asString(block.text);
			return text ? [{ kind: "refusal-delta", text }] : [];
		}
		default:
			return [];
	}
}

function finishReason(value: string | undefined): FinishReason | undefined {
	switch (value) {
		case "end_turn":
		case "stop_sequence":
			return "stop";
		case "max_tokens":
			return "length";
		case "tool_use":
			return "tool_calls";
		case "refusal":
			return "content_filter";
		case undefined:
		case null:
			return undefined;
		default:
			return "stop";
	}
}

function usageChunk(value: unknown): RawChunk | undefined {
	if (!isRecord(value)) return undefined;
	const inputTokens = asNumber(value.input_tokens);
	const outputTokens = asNumber(value.output_tokens);
	if (inputTokens === undefined && outputTokens === undefined) return undefined;
	return optionalRawChunk({ kind: "usage", inputTokens, outputTokens, raw: value });
}

function providerErrorChunks(value: unknown): RawChunk[] {
	const message = isRecord(value) ? asString(value.message) : undefined;
	return providerErrorChunksFromMessage(message ?? "Anthropic provider error", false);
}
