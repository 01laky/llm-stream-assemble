import type { RawChunk, StreamAdapter } from "../core/types";
import { libraryError, providerErrorChunksFromMessage } from "./errors";
import { parseAdapterObjectPayload } from "./shared/parse-payload";
import { textOrJsonDelta } from "./shared/text-delta";
import { asNumber, asString, createStreamAdapter, isRecord, optionalRawChunk } from "./utils";

export interface OpenAIResponsesAdapterOptions {
	jsonMode?: boolean;
}

interface ToolState {
	id: string;
	name: string;
	index: number | undefined;
	args: string;
	started: boolean;
	done: boolean;
}

export function openaiResponsesAdapter(options: OpenAIResponsesAdapterOptions = {}): StreamAdapter {
	const parser = new ResponsesParser(options);
	return createStreamAdapter({
		parser,
		parseResponse,
		options,
	});
}

class ResponsesParser {
	private metadataEmitted = false;
	private textSeen = false;
	private readonly tools = new Map<string, ToolState>();

	constructor(private readonly options: OpenAIResponsesAdapterOptions) {}

	parseChunk(raw: string): RawChunk[] {
		const payload = parseAdapterObjectPayload(raw, "openaiResponsesAdapter.parseChunk");
		if (!payload) return [];

		if (isErrorPayload(payload)) return providerErrorChunks(errorMessage(payload));

		const chunks: RawChunk[] = [];
		const response = isRecord(payload.response) ? payload.response : payload;
		if (!this.metadataEmitted && isRecord(response) && hasResponseMetadata(response)) {
			chunks.push(...metadataChunks(response));
			this.metadataEmitted = true;
		}

		const type = asString(payload.type);
		switch (type) {
			case "response.created":
			case "response.in_progress":
				break;
			case "response.output_text.delta":
				chunks.push(...this.textDelta(payload));
				break;
			case "response.output_text.done":
				chunks.push(...this.textDone(payload));
				break;
			case "response.refusal.delta":
				chunks.push(...refusalDelta(payload));
				break;
			case "response.refusal.done":
				break;
			case "response.content_part.added":
			case "response.content_part.done":
				chunks.push(...contentPartChunks(payload, this.options));
				break;
			case "response.output_item.added":
				chunks.push(...this.outputItemAdded(payload));
				break;
			case "response.output_item.delta":
				chunks.push(...this.outputItemDelta(payload));
				break;
			case "response.output_item.done":
				chunks.push(...this.outputItemDone(payload));
				break;
			case "response.function_call_arguments.delta":
				chunks.push(...this.functionArgsDelta(payload));
				break;
			case "response.function_call_arguments.done":
				chunks.push(...this.functionArgsDone(payload));
				break;
			case "response.completed":
				chunks.push(...usageFromResponse(response));
				chunks.push({ kind: "finish", reason: "stop" });
				break;
			case "response.failed":
				chunks.push(...providerErrorChunks(errorMessage(response)));
				break;
			case "response.incomplete":
				chunks.push(...usageFromResponse(response));
				chunks.push({ kind: "finish", reason: "incomplete" });
				break;
			case "error":
				chunks.push(...providerErrorChunks(errorMessage(payload)));
				break;
			default:
				chunks.push(...reasoningChunks(payload));
				break;
		}

		return chunks;
	}

	private textDelta(payload: Record<string, unknown>): RawChunk[] {
		const text = asString(payload.delta) ?? asString(payload.text);
		if (!text) return [];
		this.textSeen = true;
		const chunk = textOrJsonDelta(text, { jsonMode: this.options.jsonMode });
		return chunk ? [chunk] : [];
	}

	private textDone(payload: Record<string, unknown>): RawChunk[] {
		if (this.textSeen) return [];
		const text = asString(payload.text) ?? asString(payload.delta);
		if (!text) return [];
		this.textSeen = true;
		const chunk = textOrJsonDelta(text, { jsonMode: this.options.jsonMode });
		return chunk ? [chunk] : [];
	}

	private outputItemAdded(payload: Record<string, unknown>): RawChunk[] {
		const item = isRecord(payload.item) ? payload.item : undefined;
		if (!item) return [];
		if (asString(item.type) === "function_call") {
			const state = this.toolState(payload, item);
			const chunks: RawChunk[] = [];
			if (!state.started) {
				chunks.push(
					optionalRawChunk({
						kind: "tool-start",
						id: state.id,
						name: state.name,
						index: state.index,
					}),
				);
				state.started = true;
			}
			const args = asString(item.arguments);
			if (args && state.args.length === 0) {
				state.args += args;
				chunks.push(
					optionalRawChunk({
						kind: "tool-args-delta",
						id: state.id,
						delta: args,
						index: state.index,
					}),
				);
			}
			return chunks;
		}
		return messageItemChunks(item, this.options);
	}

	private outputItemDelta(payload: Record<string, unknown>): RawChunk[] {
		const delta = isRecord(payload.delta) ? payload.delta : payload;
		const args = asString(delta.arguments) ?? asString(delta.delta);
		if (!args) return [];
		const state = this.toolState(payload, delta);
		const chunks: RawChunk[] = [];
		if (!state.started) {
			chunks.push(
				optionalRawChunk({
					kind: "tool-start",
					id: state.id,
					name: state.name,
					index: state.index,
				}),
			);
			state.started = true;
		}
		state.args += args;
		chunks.push(
			optionalRawChunk({ kind: "tool-args-delta", id: state.id, delta: args, index: state.index }),
		);
		return chunks;
	}

	private outputItemDone(payload: Record<string, unknown>): RawChunk[] {
		const item = isRecord(payload.item) ? payload.item : payload;
		if (asString(item.type) !== "function_call") return messageItemChunks(item, this.options);
		const state = this.toolState(payload, item);
		if (state.done) return [];
		state.done = true;
		return [optionalRawChunk({ kind: "tool-done", id: state.id, index: state.index })];
	}

	private functionArgsDelta(payload: Record<string, unknown>): RawChunk[] {
		const delta = asString(payload.delta);
		if (!delta) return [];
		const state = this.toolState(payload);
		const chunks: RawChunk[] = [];
		if (!state.started) {
			chunks.push(
				optionalRawChunk({
					kind: "tool-start",
					id: state.id,
					name: state.name,
					index: state.index,
				}),
			);
			state.started = true;
		}
		state.args += delta;
		chunks.push(
			optionalRawChunk({ kind: "tool-args-delta", id: state.id, delta, index: state.index }),
		);
		return chunks;
	}

	private functionArgsDone(payload: Record<string, unknown>): RawChunk[] {
		const state = this.toolState(payload);
		const chunks: RawChunk[] = [];
		const finalArgs = asString(payload.arguments);
		if (finalArgs && finalArgs !== state.args && !finalArgs.startsWith(state.args)) {
			chunks.push(
				optionalRawChunk({
					kind: "tool-args-delta",
					id: state.id,
					delta: finalArgs,
					index: state.index,
				}),
			);
			state.args += finalArgs;
		} else if (
			finalArgs &&
			finalArgs.startsWith(state.args) &&
			finalArgs.length > state.args.length
		) {
			const missing = finalArgs.slice(state.args.length);
			chunks.push(
				optionalRawChunk({
					kind: "tool-args-delta",
					id: state.id,
					delta: missing,
					index: state.index,
				}),
			);
			state.args = finalArgs;
		}
		if (!state.started) {
			chunks.unshift(
				optionalRawChunk({
					kind: "tool-start",
					id: state.id,
					name: state.name,
					index: state.index,
				}),
			);
			state.started = true;
		}
		if (!state.done) {
			chunks.push(optionalRawChunk({ kind: "tool-done", id: state.id, index: state.index }));
			state.done = true;
		}
		return chunks;
	}

	private toolState(payload: Record<string, unknown>, item?: Record<string, unknown>): ToolState {
		const id = toolId(payload, item);
		const index = asNumber(payload.output_index);
		const existing = this.tools.get(id);
		if (existing) return existing;
		const state: ToolState = {
			id,
			name: asString(item?.name) ?? "unknown",
			index,
			args: "",
			started: false,
			done: false,
		};
		this.tools.set(id, state);
		return state;
	}
}

function parseResponse(body: unknown, options: OpenAIResponsesAdapterOptions): RawChunk[] {
	if (!isRecord(body)) {
		throw libraryError("openaiResponsesAdapter.parseResponse expected an OpenAI Responses object");
	}
	if (isErrorPayload(body) || asString(body.status) === "failed") {
		return providerErrorChunks(errorMessage(body));
	}

	const chunks: RawChunk[] = [];
	chunks.push(...metadataChunks(body));
	const output = Array.isArray(body.output) ? body.output : [];
	for (let index = 0; index < output.length; index += 1) {
		const item = output[index];
		if (!isRecord(item)) continue;
		if (asString(item.type) === "function_call") {
			const id = asString(item.call_id) ?? asString(item.id) ?? `response_tool:${index}`;
			const name = asString(item.name) ?? "unknown";
			chunks.push({ kind: "tool-start", id, name, index });
			const args = asString(item.arguments);
			if (args) chunks.push({ kind: "tool-args-delta", id, delta: args, index });
			chunks.push({ kind: "tool-done", id, index });
		} else {
			chunks.push(...messageItemChunks(item, options));
		}
	}
	chunks.push(...usageFromResponse(body));
	const status = asString(body.status);
	if (status === "incomplete") chunks.push({ kind: "finish", reason: "incomplete" });
	else chunks.push({ kind: "finish", reason: "stop" });
	return chunks;
}

function metadataChunks(response: Record<string, unknown>): RawChunk[] {
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

function hasResponseMetadata(response: Record<string, unknown>): boolean {
	return (
		asString(response.id) !== undefined ||
		asString(response.model) !== undefined ||
		asNumber(response.created_at) !== undefined
	);
}

function messageItemChunks(
	item: Record<string, unknown>,
	options: OpenAIResponsesAdapterOptions,
): RawChunk[] {
	const chunks: RawChunk[] = [];
	const content = Array.isArray(item.content) ? item.content : [];
	for (const part of content) {
		if (!isRecord(part)) continue;
		const type = asString(part.type);
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

function contentPartChunks(
	payload: Record<string, unknown>,
	options: OpenAIResponsesAdapterOptions,
): RawChunk[] {
	const part = isRecord(payload.part)
		? payload.part
		: isRecord(payload.content_part)
			? payload.content_part
			: payload;
	return messageItemChunks({ content: [part] }, options);
}

function refusalDelta(payload: Record<string, unknown>): RawChunk[] {
	const text = asString(payload.delta) ?? asString(payload.refusal) ?? asString(payload.text);
	return text ? [{ kind: "refusal-delta", text }] : [];
}

function reasoningChunks(payload: Record<string, unknown>): RawChunk[] {
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

function usageFromResponse(response: Record<string, unknown>): RawChunk[] {
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

function textChunk(text: string, options: OpenAIResponsesAdapterOptions): RawChunk {
	const chunk = textOrJsonDelta(text, { jsonMode: options.jsonMode });
	return chunk ?? { kind: "text-delta", text };
}

function providerErrorChunks(message: string): RawChunk[] {
	return providerErrorChunksFromMessage(message, false);
}

function errorMessage(payload: Record<string, unknown>): string {
	const error = isRecord(payload.error) ? payload.error : undefined;
	return (
		asString(error?.message) ??
		asString(payload.message) ??
		asString(payload.error) ??
		"OpenAI Responses provider error"
	);
}

function isErrorPayload(payload: Record<string, unknown>): boolean {
	return asString(payload.type) === "error" || payload.error !== undefined;
}

function toolId(payload: Record<string, unknown>, item?: Record<string, unknown>): string {
	const callId = asString(item?.call_id) ?? asString(payload.call_id);
	const itemId = asString(item?.id) ?? asString(payload.item_id);
	const index = asNumber(payload.output_index);
	return callId ?? itemId ?? `response_tool:${index ?? 0}`;
}
