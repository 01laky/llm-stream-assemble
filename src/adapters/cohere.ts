import type { FinishReason, RawChunk, StreamAdapter } from "../core/types";
import { libraryError, providerErrorChunksFromPayload } from "./errors";
import { incrementalJsonStringDelta } from "./shared/incremental-json";
import { parseAdapterObjectPayload } from "./shared/parse-payload";
import { textOrJsonDelta } from "./shared/text-delta";
import { buildUsageChunk, type UsageFieldAliases } from "./shared/usage";
import { asNumber, asString, createStreamAdapter, isRecord, optionalRawChunk } from "./utils";

export interface CohereAdapterOptions {
	/** Map content-delta text to json-delta instead of text-delta. */
	jsonMode?: boolean;
}

interface ToolState {
	id: string;
	name: string;
	index: number;
	open: boolean;
	lastArgsJson: string;
}

type CohereStreamEvent = Record<string, unknown> & { type?: string };

const COHERE_USAGE_ALIASES: UsageFieldAliases = {
	input: ["input_tokens", "inputTokens"],
	output: ["output_tokens", "outputTokens"],
	total: ["total_tokens", "totalTokens"],
};

export function cohereAdapter(options: CohereAdapterOptions = {}): StreamAdapter {
	const parser = new CohereStreamParser(options);
	return createStreamAdapter({
		parser,
		parseResponse,
		options,
	});
}

class CohereStreamParser {
	private messageStarted = false;
	private metadataEmitted = false;
	private readonly toolsByKey = new Map<string, ToolState>();
	private readonly indexToKey = new Map<number, string>();

	constructor(private readonly options: CohereAdapterOptions) {}

	parseChunk(raw: string): RawChunk[] {
		const payload = parseAdapterObjectPayload(raw, "cohereAdapter.parseChunk");
		if (!payload) return [];

		if (asString(payload.type) === "error" || isRecord(payload.error)) {
			const errorBody = isRecord(payload.error) ? payload.error : payload;
			return providerErrorChunksFromPayload(
				errorBody,
				"cohereAdapter.parseChunk",
				false,
				"Cohere provider error",
			);
		}

		const eventType = asString(payload.type);
		if (!eventType) return optionalMetadataRaw(payload);

		switch (eventType) {
			case "message-start":
				return this.messageStartChunks(payload);
			case "content-start":
			case "content-end":
				return [];
			case "content-delta":
				return this.contentDeltaChunks(payload);
			case "tool-plan-delta":
				return this.toolPlanDeltaChunks(payload);
			case "tool-call-start":
				return this.toolCallStartChunks(payload);
			case "tool-call-delta":
				return this.toolCallDeltaChunks(payload);
			case "tool-call-end":
				return this.toolCallEndChunks(payload);
			case "citation-start":
				return this.citationStartChunks(payload);
			case "citation-end":
				return [];
			case "message-end":
				return this.messageEndChunks(payload);
			default:
				return optionalMetadataRaw(payload);
		}
	}

	private messageStartChunks(payload: CohereStreamEvent): RawChunk[] {
		if (this.messageStarted) return [];
		this.messageStarted = true;

		const chunks: RawChunk[] = [{ kind: "message-start" }];
		const messageId = asString(payload.id);
		const delta = isRecord(payload.delta) ? payload.delta : undefined;
		const message = delta && isRecord(delta.message) ? delta.message : undefined;
		const role = message ? asString(message.role) : undefined;

		if (messageId || role) {
			this.metadataEmitted = true;
			chunks.push(
				optionalRawChunk({
					kind: "metadata",
					responseId: messageId,
					raw: { id: messageId, role },
				}),
			);
		}

		return chunks;
	}

	private contentDeltaChunks(payload: CohereStreamEvent): RawChunk[] {
		const delta = isRecord(payload.delta) ? payload.delta : undefined;
		const message = delta && isRecord(delta.message) ? delta.message : undefined;
		const content = message && isRecord(message.content) ? message.content : undefined;
		const text = content ? asString(content.text) : undefined;
		if (text === undefined || text.length === 0) return [];

		const textChunk = textOrJsonDelta(text, {
			jsonMode: this.options.jsonMode,
			choiceIndex: asNumber(payload.index) ?? 0,
		});
		return textChunk ? [textChunk] : [];
	}

	private toolPlanDeltaChunks(payload: CohereStreamEvent): RawChunk[] {
		const delta = isRecord(payload.delta) ? payload.delta : undefined;
		const message = delta && isRecord(delta.message) ? delta.message : undefined;
		const toolPlan = message ? asString(message.tool_plan) : asString(delta?.tool_plan);
		if (toolPlan === undefined || toolPlan.length === 0) return [];
		return [{ kind: "reasoning-delta", text: toolPlan, variant: "detail" }];
	}

	private toolCallStartChunks(payload: CohereStreamEvent): RawChunk[] {
		const baseIndex = asNumber(payload.index) ?? 0;
		const toolCalls = toolCallsFromDelta(payload.delta);
		if (toolCalls.length === 0) return [];

		const chunks: RawChunk[] = [];
		for (let i = 0; i < toolCalls.length; i += 1) {
			const toolCall = toolCalls[i]!;
			const index = asNumber(toolCall.index) ?? baseIndex + i;
			const id = asString(toolCall.id) ?? `cohere:tool:${index}`;
			const fn = isRecord(toolCall.function) ? toolCall.function : undefined;
			const name = fn ? (asString(fn.name) ?? "unknown") : "unknown";
			const key = reconcileToolKey(this.toolsByKey, this.indexToKey, index, id);
			const existing = this.toolsByKey.get(key);
			if (existing?.open && existing.id === id) continue;

			const state: ToolState = {
				id,
				name,
				index,
				open: true,
				lastArgsJson: asString(fn?.arguments) ?? "",
			};
			this.toolsByKey.set(key, state);
			this.indexToKey.set(index, key);
			if (id !== key) this.toolsByKey.set(id, state);

			chunks.push(
				optionalRawChunk({
					kind: "tool-start",
					id,
					name,
					index,
					choiceIndex: 0,
				}),
			);
		}
		return chunks;
	}

	private toolCallDeltaChunks(payload: CohereStreamEvent): RawChunk[] {
		const index = asNumber(payload.index) ?? 0;
		const toolCalls = toolCallsFromDelta(payload.delta);
		if (toolCalls.length === 0) return [];

		const chunks: RawChunk[] = [];
		for (const toolCall of toolCalls) {
			const lateId = asString(toolCall.id);
			const key = this.resolveToolKey(index, lateId);
			let state = key ? this.toolsByKey.get(key) : undefined;
			if (!state) {
				const fn = isRecord(toolCall.function) ? toolCall.function : undefined;
				const name = fn ? (asString(fn.name) ?? "unknown") : "unknown";
				const id = lateId ?? `cohere:tool:${index}`;
				state = { id, name, index, open: true, lastArgsJson: "" };
				this.toolsByKey.set(id, state);
				this.indexToKey.set(index, id);
				chunks.push(
					optionalRawChunk({
						kind: "tool-start",
						id,
						name,
						index,
						choiceIndex: 0,
					}),
				);
			} else if (lateId && state.id !== lateId) {
				this.reconcileLateId(state, lateId, index);
			}

			const fn = isRecord(toolCall.function) ? toolCall.function : undefined;
			const argsText = fn ? asString(fn.arguments) : undefined;
			if (argsText !== undefined && argsText.length > 0 && state) {
				const delta = incrementalJsonStringDelta(state, argsText);
				if (delta) {
					chunks.push(
						optionalRawChunk({
							kind: "tool-args-delta",
							id: state.id,
							delta,
							index: state.index,
							choiceIndex: 0,
						}),
					);
				}
			}
		}
		return chunks;
	}

	private toolCallEndChunks(payload: CohereStreamEvent): RawChunk[] {
		const index = asNumber(payload.index) ?? 0;
		const delta = isRecord(payload.delta) ? payload.delta : undefined;
		const message = delta && isRecord(delta.message) ? delta.message : undefined;
		const toolCalls = message ? toolCallsFromRecord(message.tool_calls) : [];
		const lateId = toolCalls[0] ? asString(toolCalls[0].id) : undefined;

		const key = this.resolveToolKey(index, lateId);
		const state = key ? this.toolsByKey.get(key) : undefined;
		if (!state?.open) return [];

		if (lateId && state.id !== lateId) {
			this.reconcileLateId(state, lateId, index);
		}

		state.open = false;
		return [
			optionalRawChunk({
				kind: "tool-done",
				id: state.id,
				index: state.index,
				choiceIndex: 0,
			}),
		];
	}

	private citationStartChunks(payload: CohereStreamEvent): RawChunk[] {
		const delta = isRecord(payload.delta) ? payload.delta : undefined;
		const message = delta && isRecord(delta.message) ? delta.message : undefined;
		const citations = message?.citations;
		return [
			optionalRawChunk({
				kind: "metadata",
				raw: { citation: citations, index: payload.index },
			}),
		];
	}

	private messageEndChunks(payload: CohereStreamEvent): RawChunk[] {
		const delta = isRecord(payload.delta) ? payload.delta : undefined;
		const chunks: RawChunk[] = [];

		const usageSource =
			delta && isRecord(delta.usage)
				? usageFromCohereUsage(delta.usage)
				: delta && isRecord(delta.billed_units)
					? delta.billed_units
					: undefined;
		const usage = buildUsageChunk(usageSource, COHERE_USAGE_ALIASES);
		if (usage) chunks.push(usage);

		const finishReason = delta ? asString(delta.finish_reason) : undefined;
		if (finishReason) {
			chunks.push(
				optionalRawChunk({
					kind: "metadata",
					raw: { finish_reason: finishReason },
				}),
			);
			chunks.push({
				kind: "finish",
				reason: mapCohereFinishReason(finishReason),
				choiceIndex: 0,
			});
		}

		return chunks;
	}

	private resolveToolKey(index: number, id: string | undefined): string | undefined {
		if (id && this.toolsByKey.has(id)) return id;
		const byIndex = this.indexToKey.get(index);
		if (byIndex) return byIndex;
		if (id) return id;
		return this.indexToKey.get(index);
	}

	private reconcileLateId(state: ToolState, lateId: string, index: number): void {
		const oldKey = state.id;
		state.id = lateId;
		this.toolsByKey.delete(oldKey);
		this.toolsByKey.set(lateId, state);
		this.indexToKey.set(index, lateId);
	}
}

function parseResponse(body: unknown, options: CohereAdapterOptions): RawChunk[] {
	if (!isRecord(body)) {
		throw libraryError("cohereAdapter.parseResponse expected a Cohere Chat v2 response object");
	}

	if (asString(body.type) === "error" || isRecord(body.error)) {
		const errorBody = isRecord(body.error) ? body.error : body;
		return providerErrorChunksFromPayload(
			errorBody,
			"cohereAdapter.parseResponse",
			false,
			"Cohere provider error",
		);
	}

	const message = isRecord(body.message) ? body.message : undefined;
	if (!message) {
		const chunks: RawChunk[] = [];
		const usage = buildUsageChunk(body.usage, COHERE_USAGE_ALIASES);
		if (usage) chunks.push(usage);
		const finishReason = asString(body.finish_reason);
		if (finishReason) {
			chunks.push({
				kind: "finish",
				reason: mapCohereFinishReason(finishReason),
				choiceIndex: 0,
			});
		} else {
			chunks.push({ kind: "finish", reason: "stop", choiceIndex: 0 });
		}
		return chunks;
	}

	const parser = new CohereStreamParser(options);
	const syntheticEvents = synthesizeCohereStreamEvents(body);
	const chunks: RawChunk[] = [];
	for (const event of syntheticEvents) {
		chunks.push(...parser.parseChunk(JSON.stringify(event)));
	}

	const finishReason = asString(body.finish_reason);
	if (finishReason && !chunks.some((chunk) => chunk.kind === "finish")) {
		chunks.push({
			kind: "finish",
			reason: mapCohereFinishReason(finishReason),
			choiceIndex: 0,
		});
	} else if (!chunks.some((chunk) => chunk.kind === "finish")) {
		chunks.push({ kind: "finish", reason: "stop", choiceIndex: 0 });
	}

	return chunks;
}

function synthesizeCohereStreamEvents(body: Record<string, unknown>): unknown[] {
	const events: unknown[] = [];
	const message = isRecord(body.message) ? body.message : undefined;
	if (!message) return events;

	const messageId = asString(body.id);
	events.push({
		type: "message-start",
		...(messageId ? { id: messageId } : {}),
		delta: { message: { role: asString(message.role) ?? "assistant" } },
	});

	const toolPlan = asString(message.tool_plan);
	if (toolPlan) {
		events.push({
			type: "tool-plan-delta",
			delta: { message: { tool_plan: toolPlan } },
		});
	}

	const content = Array.isArray(message.content) ? message.content : [];
	for (const block of content) {
		if (!isRecord(block)) continue;
		const text = asString(block.text);
		if (text !== undefined && text.length > 0) {
			events.push({
				type: "content-delta",
				index: 0,
				delta: { message: { content: { text } } },
			});
		}
	}

	const citations = message.citations;
	if (Array.isArray(citations)) {
		for (const citation of citations) {
			events.push({
				type: "citation-start",
				index: 0,
				delta: { message: { citations: citation } },
			});
		}
	}

	const toolCalls = toolCallsFromRecord(message.tool_calls);
	let toolIndex = 0;
	for (const toolCall of toolCalls) {
		const id = asString(toolCall.id) ?? `cohere:tool:${toolIndex}`;
		const fn = isRecord(toolCall.function) ? toolCall.function : undefined;
		const name = fn ? (asString(fn.name) ?? "unknown") : "unknown";
		const args = fn ? asString(fn.arguments) : undefined;
		events.push({
			type: "tool-call-start",
			index: toolIndex,
			delta: {
				message: {
					tool_calls: {
						id,
						type: "function",
						function: { name, arguments: args ?? "" },
					},
				},
			},
		});
		if (args !== undefined && args.length > 0) {
			events.push({
				type: "tool-call-delta",
				index: toolIndex,
				delta: {
					message: {
						tool_calls: {
							id,
							function: { arguments: args },
						},
					},
				},
			});
		}
		events.push({ type: "tool-call-end", index: toolIndex });
		toolIndex += 1;
	}

	if (body.usage !== undefined || body.finish_reason !== undefined) {
		events.push({
			type: "message-end",
			delta: {
				...(body.finish_reason !== undefined ? { finish_reason: body.finish_reason } : {}),
				...(body.usage !== undefined ? { usage: body.usage } : {}),
			},
		});
	}

	return events;
}

function toolCallsFromDelta(delta: unknown): Record<string, unknown>[] {
	if (!isRecord(delta)) return [];
	const message = isRecord(delta.message) ? delta.message : undefined;
	return toolCallsFromRecord(message?.tool_calls);
}

function toolCallsFromRecord(value: unknown): Record<string, unknown>[] {
	if (value === undefined) return [];
	if (Array.isArray(value)) {
		return value.filter((item): item is Record<string, unknown> => isRecord(item));
	}
	if (isRecord(value)) return [value];
	return [];
}

function usageFromCohereUsage(usage: Record<string, unknown>): Record<string, unknown> | undefined {
	const billed = isRecord(usage.billed_units) ? usage.billed_units : undefined;
	if (billed) return billed;
	const tokens = isRecord(usage.tokens) ? usage.tokens : undefined;
	if (tokens) return tokens;
	return usage;
}

function reconcileToolKey(
	toolsByKey: Map<string, ToolState>,
	indexToKey: Map<number, string>,
	index: number,
	id: string,
): string {
	const existingIndexKey = indexToKey.get(index);
	if (existingIndexKey && toolsByKey.has(existingIndexKey)) {
		const state = toolsByKey.get(existingIndexKey);
		if (state && state.id.startsWith("cohere:tool:") && !id.startsWith("cohere:tool:")) {
			toolsByKey.delete(existingIndexKey);
			state.id = id;
			toolsByKey.set(id, state);
			indexToKey.set(index, id);
			return id;
		}
		return existingIndexKey;
	}
	return id;
}

function mapCohereFinishReason(value: string): FinishReason {
	const normalized = value.toUpperCase();
	switch (normalized) {
		case "COMPLETE":
		case "STOP_SEQUENCE":
			return "stop";
		case "MAX_TOKENS":
			return "length";
		case "TOOL_CALL":
			return "tool_calls";
		case "ERROR":
		case "TIMEOUT":
			return "error";
		default:
			if (normalized.includes("FILTER") || normalized.includes("SAFETY")) {
				return "content_filter";
			}
			return "stop";
	}
}

function optionalMetadataRaw(payload: Record<string, unknown>): RawChunk[] {
	if (Object.keys(payload).length === 0) return [];
	return [
		optionalRawChunk({
			kind: "metadata",
			raw: payload,
		}),
	];
}
