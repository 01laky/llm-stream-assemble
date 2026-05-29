import type { RawChunk } from "../../core/types";
import { incrementalJsonStringDelta } from "../common/incremental-json";
import { asString, isRecord, optionalRawChunk } from "../utils";
import type { ToolState } from "./types";

export function partialArgDelta(arg: Record<string, unknown>): string | undefined {
	const stringValue = asString(arg.stringValue);
	if (stringValue !== undefined) return stringValue;

	const jsonPath = asString(arg.jsonPath) ?? "$";
	const key = jsonPath.replace(/^\$\.?/, "").split(".")[0] ?? "value";
	if (arg.numberValue !== undefined) return JSON.stringify({ [key]: arg.numberValue });
	if (arg.boolValue !== undefined) return JSON.stringify({ [key]: arg.boolValue });
	if (arg.nullValue !== undefined) return JSON.stringify({ [key]: null });
	return undefined;
}

export function resolveToolKey(
	tools: Map<string, ToolState>,
	openToolByChoice: Map<number, string>,
	explicitId: string | undefined,
	partIndex: number,
	choiceIndex: number,
	name: string | undefined,
): string {
	if (explicitId) return explicitId;
	const openKey = openToolByChoice.get(choiceIndex);
	if (openKey && tools.get(openKey)?.open) return openKey;
	if (name) {
		for (const [key, state] of tools) {
			if (state.choiceIndex === choiceIndex && state.name === name && state.open) return key;
		}
	}
	return `${choiceIndex}:${partIndex}`;
}

export function functionCallChunksFromPart(params: {
	functionCall: Record<string, unknown>;
	partIndex: number;
	choiceIndex: number;
	tools: Map<string, ToolState>;
	openToolByChoice: Map<number, string>;
	toolCounter: number;
}): { chunks: RawChunk[]; toolCounter: number } {
	const { functionCall, partIndex, choiceIndex, tools, openToolByChoice } = params;
	let { toolCounter } = params;
	const chunks: RawChunk[] = [];
	const explicitId = asString(functionCall.id);
	const name = asString(functionCall.name);
	let toolKey = resolveToolKey(tools, openToolByChoice, explicitId, partIndex, choiceIndex, name);

	if (name && !tools.has(toolKey)) {
		toolKey = explicitId ?? `${choiceIndex}:${partIndex}`;
		const id = explicitId ?? `gemini:${choiceIndex}:${toolCounter++}`;
		tools.set(toolKey, {
			id,
			name,
			index: partIndex,
			choiceIndex,
			lastArgsJson: "",
			open: true,
		});
		openToolByChoice.set(choiceIndex, toolKey);
		chunks.push(
			optionalRawChunk({
				kind: "tool-start",
				id,
				name,
				index: partIndex,
				choiceIndex,
			}),
		);
	}

	const current = tools.get(toolKey);
	if (!current) return { chunks, toolCounter };

	const partialArgs = Array.isArray(functionCall.partialArgs) ? functionCall.partialArgs : [];
	for (const item of partialArgs) {
		if (!isRecord(item)) continue;
		const delta = partialArgDelta(item);
		if (delta) {
			chunks.push(
				optionalRawChunk({
					kind: "tool-args-delta",
					id: current.id,
					delta,
					index: current.index,
					choiceIndex,
				}),
			);
		}
	}

	if (isRecord(functionCall.args)) {
		const delta = incrementalJsonStringDelta(current, JSON.stringify(functionCall.args));
		if (delta) {
			chunks.push(
				optionalRawChunk({
					kind: "tool-args-delta",
					id: current.id,
					delta,
					index: current.index,
					choiceIndex,
				}),
			);
		}
	}

	const willContinue = functionCall.willContinue === true;
	const hasPartialArgs = partialArgs.length > 0;
	const hasArgs = isRecord(functionCall.args) && Object.keys(functionCall.args).length > 0;

	if (!willContinue && !hasPartialArgs && (hasArgs || (name && isRecord(functionCall.args)))) {
		chunks.push(
			optionalRawChunk({
				kind: "tool-done",
				id: current.id,
				index: current.index,
				choiceIndex,
			}),
		);
		current.open = false;
	} else if (
		!willContinue &&
		hasPartialArgs &&
		partialArgs.every((item) => isRecord(item) && item.willContinue !== true)
	) {
		if (current.open) {
			chunks.push(
				optionalRawChunk({
					kind: "tool-done",
					id: current.id,
					index: current.index,
					choiceIndex,
				}),
			);
			current.open = false;
		}
	}

	return { chunks, toolCounter };
}
