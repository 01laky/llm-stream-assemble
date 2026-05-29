import type { RawChunk } from "../../core/types";
import { providerErrorChunksFromPayload } from "../errors";
import { incrementalJsonStringDelta } from "../common/incremental-json";
import { parseAdapterObjectPayload } from "../common/parse-payload";
import { buildUsageChunk } from "../common/usage";
import { asNumber, asString, isRecord, optionalRawChunk } from "../utils";
import { mapCohereFinishReason } from "./finish-reason";
import {
	citationStartChunks,
	contentDeltaChunk,
	optionalMetadataRaw,
	reconcileLateToolId,
	reconcileToolKey,
	resolveToolKey,
	toolPlanDeltaChunk,
	toolCallsFromDelta,
	toolCallsFromRecord,
	usageFromCohereUsage,
} from "./helpers";
import {
	COHERE_USAGE_ALIASES,
	type CohereAdapterOptions,
	type CohereStreamEvent,
	type ToolState,
} from "./types";

export class CohereStreamParser {
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
			case "content-delta": {
				const contentDelta = contentDeltaChunk(payload, this.options.jsonMode);
				return contentDelta ? [contentDelta] : [];
			}
			case "tool-plan-delta": {
				const toolPlanDelta = toolPlanDeltaChunk(payload);
				return toolPlanDelta ? [toolPlanDelta] : [];
			}
			case "tool-call-start":
				return this.toolCallStartChunks(payload);
			case "tool-call-delta":
				return this.toolCallDeltaChunks(payload);
			case "tool-call-end":
				return this.toolCallEndChunks(payload);
			case "citation-start":
				return citationStartChunks(payload, this.options.emitLegacyCitationMetadata ?? false);
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
			const key = resolveToolKey(this.toolsByKey, this.indexToKey, index, lateId);
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
				reconcileLateToolId(this.toolsByKey, this.indexToKey, state, lateId, index);
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

		const key = resolveToolKey(this.toolsByKey, this.indexToKey, index, lateId);
		const state = key ? this.toolsByKey.get(key) : undefined;
		if (!state?.open) return [];

		if (lateId && state.id !== lateId) {
			reconcileLateToolId(this.toolsByKey, this.indexToKey, state, lateId, index);
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
}
