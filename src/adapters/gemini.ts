import type { FinishReason, RawChunk, StreamAdapter } from "../core/types";
import {
	libraryError,
	providerErrorChunksFromMessage,
	providerErrorChunksFromPayload,
} from "./errors";
import { incrementalJsonStringDelta } from "./shared/incremental-json";
import { parseAdapterObjectPayload } from "./shared/parse-payload";
import { textOrJsonDelta } from "./shared/text-delta";
import { buildUsageChunk } from "./shared/usage";
import { asNumber, asString, createStreamAdapter, isRecord, optionalRawChunk } from "./utils";

export type GeminiApiSurface = "google-ai" | "vertex";

export interface GeminiAdapterOptions {
	/** Map text parts to json-delta instead of text-delta. */
	jsonMode?: boolean;
	/**
	 * Which Gemini HTTP API produced the chunk JSON.
	 * @default "google-ai"
	 */
	apiSurface?: GeminiApiSurface;
}

interface ToolState {
	id: string;
	name: string;
	index: number;
	choiceIndex: number;
	lastArgsJson: string;
	open: boolean;
}

export function geminiAdapter(options: GeminiAdapterOptions = {}): StreamAdapter {
	const parser = new GeminiStreamParser(options);
	return createStreamAdapter({
		parser,
		parseResponse,
		options,
	});
}

class GeminiStreamParser {
	private metadataEmitted = false;
	private readonly tools = new Map<string, ToolState>();
	private readonly openToolByChoice = new Map<number, string>();
	private toolCounter = 0;

	constructor(private readonly options: GeminiAdapterOptions) {}

	parseChunk(raw: string): RawChunk[] {
		let payload = parseAdapterObjectPayload(raw, "geminiAdapter.parseChunk");
		if (!payload) return [];

		if (this.options.apiSurface === "vertex") {
			const normalized = normalizeVertexChunk(payload);
			if (!normalized) {
				if (Object.keys(payload).length === 0) return [];
				return [
					optionalRawChunk({
						kind: "metadata",
						raw: payload,
					}),
				].filter((chunk): chunk is RawChunk => chunk !== undefined);
			}
			payload = normalized;
		}

		if (isRecord(payload.error)) {
			return providerErrorChunksFromPayload(
				payload.error,
				"geminiAdapter.parseChunk",
				false,
				"Gemini provider error",
			);
		}

		const chunks: RawChunk[] = [];
		const feedback = isRecord(payload.promptFeedback) ? payload.promptFeedback : undefined;
		const blockReason = feedback ? asString(feedback.blockReason) : undefined;
		if (blockReason) {
			return providerErrorChunksFromMessage(`Gemini prompt blocked: ${blockReason}`, false);
		}

		chunks.push(...this.metadataChunks(payload));

		const usage = buildUsageChunk(payload.usageMetadata);
		if (usage) chunks.push(usage);

		const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];
		for (const candidate of candidates) {
			if (!isRecord(candidate)) continue;
			chunks.push(...this.candidateChunks(candidate));
		}

		return chunks;
	}

	private metadataChunks(payload: Record<string, unknown>): RawChunk[] {
		if (this.metadataEmitted) return [];
		const responseId = asString(payload.responseId);
		const model = asString(payload.modelVersion);
		if (!responseId && !model) return [];

		this.metadataEmitted = true;
		const chunks: RawChunk[] = [];
		if (responseId) chunks.push({ kind: "message-start", id: responseId });
		chunks.push(
			optionalRawChunk({
				kind: "metadata",
				responseId,
				model,
				raw: { responseId, modelVersion: model },
			}),
		);
		return chunks;
	}

	private candidateChunks(candidate: Record<string, unknown>): RawChunk[] {
		const chunks: RawChunk[] = [];
		const choiceIndex = asNumber(candidate.index) ?? 0;

		const citation = candidate.citationMetadata;
		const grounding = candidate.groundingMetadata;
		if (citation !== undefined || grounding !== undefined) {
			chunks.push(
				optionalRawChunk({
					kind: "metadata",
					raw: { citationMetadata: citation, groundingMetadata: grounding },
				}),
			);
		}

		const content = isRecord(candidate.content) ? candidate.content : undefined;
		const parts = content && Array.isArray(content.parts) ? content.parts : [];
		for (let partIndex = 0; partIndex < parts.length; partIndex += 1) {
			const part = parts[partIndex];
			if (!isRecord(part)) continue;
			chunks.push(...this.partChunks(part, partIndex, choiceIndex));
		}

		const finishReason = asString(candidate.finishReason);
		if (finishReason) {
			const mapped = mapFinishReason(finishReason);
			if (mapped === "error") {
				chunks.push(
					...providerErrorChunksFromMessage(`Gemini finishReason: ${finishReason}`, false),
				);
			} else {
				chunks.push({ kind: "finish", reason: mapped, choiceIndex });
			}
		}

		return chunks;
	}

	private partChunks(
		part: Record<string, unknown>,
		partIndex: number,
		choiceIndex: number,
	): RawChunk[] {
		if (isRecord(part.functionResponse)) return [];
		if (part.inlineData !== undefined || part.fileData !== undefined) return [];
		if (part.executableCode !== undefined || part.codeExecutionResult !== undefined) return [];

		const thought = part.thought === true;
		const text = asString(part.text);
		if (thought && text) {
			return [{ kind: "reasoning-delta", text, variant: "detail" }];
		}
		if (thought && !text) return [];

		if (text !== undefined) {
			const chunk = textOrJsonDelta(text, {
				jsonMode: this.options.jsonMode,
				choiceIndex,
			});
			return chunk ? [chunk] : [];
		}

		const functionCall = isRecord(part.functionCall) ? part.functionCall : undefined;
		if (functionCall) return this.functionCallChunks(functionCall, partIndex, choiceIndex);

		if (Object.keys(part).length === 0) return [];
		return [];
	}

	private functionCallChunks(
		functionCall: Record<string, unknown>,
		partIndex: number,
		choiceIndex: number,
	): RawChunk[] {
		const chunks: RawChunk[] = [];
		const explicitId = asString(functionCall.id);
		const name = asString(functionCall.name);
		let toolKey = this.resolveToolKey(explicitId, partIndex, choiceIndex, name);

		if (name && !this.tools.has(toolKey)) {
			toolKey = explicitId ?? `${choiceIndex}:${partIndex}`;
			const id = explicitId ?? `gemini:${choiceIndex}:${this.toolCounter++}`;
			this.tools.set(toolKey, {
				id,
				name,
				index: partIndex,
				choiceIndex,
				lastArgsJson: "",
				open: true,
			});
			this.openToolByChoice.set(choiceIndex, toolKey);
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

		const current = this.tools.get(toolKey);
		if (!current) return chunks;

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

		return chunks;
	}

	private resolveToolKey(
		explicitId: string | undefined,
		partIndex: number,
		choiceIndex: number,
		name: string | undefined,
	): string {
		if (explicitId) return explicitId;
		const openKey = this.openToolByChoice.get(choiceIndex);
		if (openKey && this.tools.get(openKey)?.open) return openKey;
		if (name) {
			for (const [key, state] of this.tools) {
				if (state.choiceIndex === choiceIndex && state.name === name && state.open) return key;
			}
		}
		return `${choiceIndex}:${partIndex}`;
	}
}

function parseResponse(body: unknown, options: GeminiAdapterOptions): RawChunk[] {
	if (!isRecord(body)) {
		throw libraryError("geminiAdapter.parseResponse expected a GenerateContentResponse object");
	}

	let record = body;
	if (options.apiSurface === "vertex") {
		const normalized = normalizeVertexChunk(body);
		if (normalized) record = normalized;
	}

	const parser = new GeminiStreamParser(options);
	const chunks: RawChunk[] = [];

	if (isRecord(record.error)) {
		return providerErrorChunksFromPayload(
			record.error,
			"geminiAdapter.parseResponse",
			false,
			"Gemini provider error",
		);
	}

	const feedback = isRecord(record.promptFeedback) ? record.promptFeedback : undefined;
	const blockReason = feedback ? asString(feedback.blockReason) : undefined;
	if (blockReason) {
		return providerErrorChunksFromMessage(`Gemini prompt blocked: ${blockReason}`, false);
	}

	chunks.push(...parser.parseChunk(JSON.stringify(record)));

	const hasFinish = chunks.some((chunk) => chunk.kind === "finish");
	if (!hasFinish) {
		chunks.push({ kind: "finish", reason: "stop" });
	}

	return chunks;
}

function partialArgDelta(arg: Record<string, unknown>): string | undefined {
	const stringValue = asString(arg.stringValue);
	if (stringValue !== undefined) return stringValue;

	const jsonPath = asString(arg.jsonPath) ?? "$";
	const key = jsonPath.replace(/^\$\.?/, "").split(".")[0] ?? "value";
	if (arg.numberValue !== undefined) return JSON.stringify({ [key]: arg.numberValue });
	if (arg.boolValue !== undefined) return JSON.stringify({ [key]: arg.boolValue });
	if (arg.nullValue !== undefined) return JSON.stringify({ [key]: null });
	return undefined;
}

function mapFinishReason(value: string): FinishReason {
	switch (value) {
		case "STOP":
		case "STOP_REASON_UNSPECIFIED":
			return "stop";
		case "MAX_TOKENS":
			return "length";
		case "SAFETY":
		case "RECITATION":
		case "BLOCKLIST":
		case "PROHIBITED_CONTENT":
		case "SPII":
		case "LANGUAGE":
			return "content_filter";
		case "MALFORMED_FUNCTION_CALL":
			return "error";
		default:
			return "error";
	}
}

/** Strip Vertex / gateway wrappers before mapping GenerateContentResponse fields. */
export function normalizeVertexChunk(
	payload: Record<string, unknown>,
): Record<string, unknown> | null {
	if (isRecord(payload.response)) {
		return payload.response;
	}
	if (isRecord(payload.result)) {
		return payload.result;
	}
	if (Array.isArray(payload.predictions)) {
		const first = payload.predictions[0];
		if (isRecord(first)) return first;
	}
	if (
		payload.candidates !== undefined ||
		payload.usageMetadata !== undefined ||
		payload.promptFeedback !== undefined ||
		payload.responseId !== undefined ||
		isRecord(payload.error)
	) {
		return payload;
	}
	return null;
}
