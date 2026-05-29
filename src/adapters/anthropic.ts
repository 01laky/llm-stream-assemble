import type { FinishReason, RawChunk, StreamAdapter } from "../core/types";
import { anthropicBlockStartChunks, anthropicResponseBlockChunks } from "./common/anthropic-blocks";
import { parseAdapterObjectPayload } from "./common/parse-payload";
import { mapAnthropicLikeStopReason } from "./common/stop-reasons";
import { buildUsageChunk } from "./common/usage";
import {
	libraryError,
	providerErrorChunksFromMessage,
	providerErrorChunksFromPayload,
} from "./errors";
import { asNumber, asString, createStreamAdapter, isRecord, optionalRawChunk } from "./utils";

export interface AnthropicAdapterOptions {
	/** Map `json` content blocks to json-delta instead of text-delta. */
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
		const payload = parseAdapterObjectPayload(raw, "anthropicAdapter.parseChunk");
		if (!payload) return [];

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
				return providerErrorFromPayload(payload.error);
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
		const usage = buildUsageChunk(message.usage);
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

		if (blockType === "tool_use") {
			const id = asString(block.id);
			const name = asString(block.name) ?? "unknown";
			if (id) state.id = id;
			state.name = name;
		}

		return anthropicBlockStartChunks(block, index, {
			jsonMode: this.options.jsonMode,
			mode: "stream-start",
		});
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
				if (this.options.jsonMode || state?.type === "json") {
					return [{ kind: "json-delta", delta: text }];
				}
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
		const usage = buildUsageChunk(payload.usage);
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
		return providerErrorFromPayload(body.error);
	}

	const chunks: RawChunk[] = [];
	const id = asString(body.id);
	const model = asString(body.model);
	if (id) chunks.push({ kind: "message-start", id });
	if (id || model) {
		chunks.push(optionalRawChunk({ kind: "metadata", responseId: id, model, raw: body }));
	}
	const inputUsage = buildUsageChunk(body.usage);
	if (inputUsage) chunks.push(inputUsage);

	const content = Array.isArray(body.content) ? body.content : [];
	for (let index = 0; index < content.length; index += 1) {
		const block = content[index];
		if (!isRecord(block)) continue;
		chunks.push(...anthropicResponseBlockChunks(block, index, { jsonMode: options.jsonMode }));
	}

	const reason = finishReason(asString(body.stop_reason));
	if (reason) chunks.push({ kind: "finish", reason });
	return chunks;
}

function finishReason(value: string | undefined): FinishReason | undefined {
	if (value === undefined || value === null) return undefined;
	return mapAnthropicLikeStopReason(value);
}

function providerErrorFromPayload(value: unknown): RawChunk[] {
	if (isRecord(value)) {
		return providerErrorChunksFromPayload(
			value,
			"anthropicAdapter.parseChunk",
			false,
			"Anthropic provider error",
		);
	}
	return providerErrorChunksFromMessage("Anthropic provider error", false);
}
