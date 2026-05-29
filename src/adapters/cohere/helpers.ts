import type { RawChunk } from "../../core/types";
import { cohereCitationFromStartPayload } from "../common/citation-grounding";
import { textOrJsonDelta } from "../common/text-delta";
import { asNumber, asString, isRecord, optionalRawChunk } from "../utils";
import type { ToolState } from "./types";

export function toolCallsFromDelta(delta: unknown): Record<string, unknown>[] {
	if (!isRecord(delta)) return [];
	const message = isRecord(delta.message) ? delta.message : undefined;
	return toolCallsFromRecord(message?.tool_calls);
}

export function toolCallsFromRecord(value: unknown): Record<string, unknown>[] {
	if (value === undefined) return [];
	if (Array.isArray(value)) {
		return value.filter((item): item is Record<string, unknown> => isRecord(item));
	}
	if (isRecord(value)) return [value];
	return [];
}

export function usageFromCohereUsage(
	usage: Record<string, unknown>,
): Record<string, unknown> | undefined {
	const billed = isRecord(usage.billed_units) ? usage.billed_units : undefined;
	if (billed) return billed;
	const tokens = isRecord(usage.tokens) ? usage.tokens : undefined;
	if (tokens) return tokens;
	return usage;
}

export function reconcileToolKey(
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

export function resolveToolKey(
	toolsByKey: Map<string, ToolState>,
	indexToKey: Map<number, string>,
	index: number,
	id: string | undefined,
): string | undefined {
	if (id && toolsByKey.has(id)) return id;
	const byIndex = indexToKey.get(index);
	if (byIndex) return byIndex;
	if (id) return id;
	return indexToKey.get(index);
}

export function reconcileLateToolId(
	toolsByKey: Map<string, ToolState>,
	indexToKey: Map<number, string>,
	state: ToolState,
	lateId: string,
	index: number,
): void {
	const oldKey = state.id;
	state.id = lateId;
	toolsByKey.delete(oldKey);
	toolsByKey.set(lateId, state);
	indexToKey.set(index, lateId);
}

export function optionalMetadataRaw(payload: Record<string, unknown>): RawChunk[] {
	if (Object.keys(payload).length === 0) return [];
	return [
		optionalRawChunk({
			kind: "metadata",
			raw: payload,
		}),
	];
}

export function contentDeltaChunk(
	payload: Record<string, unknown>,
	jsonMode: boolean | undefined,
): RawChunk | undefined {
	const delta = isRecord(payload.delta) ? payload.delta : undefined;
	const message = delta && isRecord(delta.message) ? delta.message : undefined;
	const content = message && isRecord(message.content) ? message.content : undefined;
	const text = content ? asString(content.text) : undefined;
	if (text === undefined || text.length === 0) return undefined;
	return textOrJsonDelta(text, {
		jsonMode,
		choiceIndex: asNumber(payload.index) ?? 0,
	});
}

export function toolPlanDeltaChunk(payload: Record<string, unknown>): RawChunk | undefined {
	const delta = isRecord(payload.delta) ? payload.delta : undefined;
	const message = delta && isRecord(delta.message) ? delta.message : undefined;
	const toolPlan = message ? asString(message.tool_plan) : asString(delta?.tool_plan);
	if (toolPlan === undefined || toolPlan.length === 0) return undefined;
	return { kind: "reasoning-delta", text: toolPlan, variant: "detail" };
}

export function citationStartChunks(
	payload: Record<string, unknown>,
	emitLegacyCitationMetadata: boolean,
): RawChunk[] {
	const delta = isRecord(payload.delta) ? payload.delta : undefined;
	const message = delta && isRecord(delta.message) ? delta.message : undefined;
	const citations = message?.citations;
	return cohereCitationFromStartPayload(citations, asNumber(payload.index), {
		emitLegacyCitationMetadata,
	});
}
