import type { RawChunk } from "../../core/types";
import { asNumber, asString, isRecord, optionalRawChunk } from "../utils";
import { toolId } from "./common";
import { outputItemMessageChunks } from "./item-events";
import type { ResponsesParserContext, ToolState } from "./types";

export function outputItemAddedChunks(
	context: ResponsesParserContext,
	payload: Record<string, unknown>,
): RawChunk[] {
	const item = isRecord(payload.item) ? payload.item : undefined;
	if (!item) return [];
	if (asString(item.type) === "function_call") {
		const state = getToolState(context, payload, item);
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
	return outputItemMessageChunks(context, payload);
}

export function outputItemDeltaChunks(
	context: ResponsesParserContext,
	payload: Record<string, unknown>,
): RawChunk[] {
	const delta = isRecord(payload.delta) ? payload.delta : payload;
	const args = asString(delta.arguments) ?? asString(delta.delta);
	if (!args) return [];
	const state = getToolState(context, payload, delta);
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

export function outputItemDoneChunks(
	context: ResponsesParserContext,
	payload: Record<string, unknown>,
): RawChunk[] {
	const item = isRecord(payload.item) ? payload.item : payload;
	if (asString(item.type) !== "function_call") {
		return outputItemMessageChunks(context, payload);
	}
	const state = getToolState(context, payload, item);
	if (state.done) return [];
	state.done = true;
	return [optionalRawChunk({ kind: "tool-done", id: state.id, index: state.index })];
}

export function functionArgsDeltaChunks(
	context: ResponsesParserContext,
	payload: Record<string, unknown>,
): RawChunk[] {
	const delta = asString(payload.delta);
	if (!delta) return [];
	const state = getToolState(context, payload);
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

export function functionArgsDoneChunks(
	context: ResponsesParserContext,
	payload: Record<string, unknown>,
): RawChunk[] {
	const state = getToolState(context, payload);
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

function getToolState(
	context: ResponsesParserContext,
	payload: Record<string, unknown>,
	item?: Record<string, unknown>,
): ToolState {
	const id = toolId(payload, item);
	const index = asNumber(payload.output_index);
	const existing = context.tools.get(id);
	if (existing) return existing;
	const state: ToolState = {
		id,
		name: asString(item?.name) ?? "unknown",
		index,
		args: "",
		started: false,
		done: false,
	};
	context.tools.set(id, state);
	return state;
}
