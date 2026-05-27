import type { RawChunk } from "../../core/types";
import { asNumber, asString, isRecord, optionalRawChunk } from "../utils";

export type LogprobChannel = "content" | "refusal";

export interface LogprobPositionState {
	readonly positions: Map<string, number>;
}

export function createLogprobPositionState(): LogprobPositionState {
	return { positions: new Map() };
}

export function logprobPositionKey(
	choiceIndex: number | undefined,
	channel: LogprobChannel,
): string {
	return `${choiceIndex ?? 0}:${channel}`;
}

export function nextLogprobPosition(
	state: LogprobPositionState,
	choiceIndex: number | undefined,
	channel: LogprobChannel,
): number {
	const key = logprobPositionKey(choiceIndex, channel);
	const next = state.positions.get(key) ?? 0;
	state.positions.set(key, next + 1);
	return next;
}

export function normalizeTopLogprobs(
	value: unknown,
): Array<{ token: string; logprob: number; bytes?: number[] }> | undefined {
	if (!Array.isArray(value) || value.length === 0) return undefined;
	const result: Array<{ token: string; logprob: number; bytes?: number[] }> = [];
	for (const entry of value) {
		if (!isRecord(entry)) continue;
		const token = asString(entry.token);
		const logprob = asNumber(entry.logprob);
		if (token === undefined || logprob === undefined) continue;
		const item: { token: string; logprob: number; bytes?: number[] } = { token, logprob };
		if (Array.isArray(entry.bytes)) {
			const bytes = entry.bytes.filter((byte): byte is number => typeof byte === "number");
			if (bytes.length > 0) item.bytes = bytes;
		}
		result.push(item);
	}
	return result.length > 0 ? result : undefined;
}

export function logprobEntryFromProvider(
	entry: unknown,
	channel: LogprobChannel,
	choiceIndex?: number,
	position?: number,
): RawChunk | undefined {
	if (!isRecord(entry)) return undefined;
	const token = asString(entry.token);
	if (token === undefined || token.length === 0) return undefined;
	const logprob = asNumber(entry.logprob);
	if (logprob === undefined) return undefined;

	const chunk: Extract<RawChunk, { kind: "logprob" }> = {
		kind: "logprob",
		channel,
		token,
		logprob,
		raw: entry,
	};
	if (Array.isArray(entry.bytes)) {
		const bytes = entry.bytes.filter((byte): byte is number => typeof byte === "number");
		if (bytes.length > 0) chunk.bytes = bytes;
	}
	const topLogprobs = normalizeTopLogprobs(entry.top_logprobs);
	if (topLogprobs) chunk.topLogprobs = topLogprobs;
	if (choiceIndex !== undefined) chunk.choiceIndex = choiceIndex;
	if (position !== undefined) chunk.position = position;
	return optionalRawChunk(chunk);
}

export function logprobChunksFromChoiceLogprobs(
	logprobs: unknown,
	choiceIndex?: number,
	positionState?: LogprobPositionState,
): RawChunk[] {
	if (logprobs === null || logprobs === undefined) return [];
	if (!isRecord(logprobs)) return [];

	const chunks: RawChunk[] = [];
	const content = logprobs.content;
	const refusal = logprobs.refusal;

	if (Array.isArray(content)) {
		for (let index = 0; index < content.length; index += 1) {
			const position = positionState
				? nextLogprobPosition(positionState, choiceIndex, "content")
				: index;
			const chunk = logprobEntryFromProvider(content[index], "content", choiceIndex, position);
			if (chunk) chunks.push(chunk);
		}
	}

	if (Array.isArray(refusal)) {
		for (let index = 0; index < refusal.length; index += 1) {
			const position = positionState
				? nextLogprobPosition(positionState, choiceIndex, "refusal")
				: index;
			const chunk = logprobEntryFromProvider(refusal[index], "refusal", choiceIndex, position);
			if (chunk) chunks.push(chunk);
		}
	}

	return chunks;
}
