import type { FinishReason, RawChunk } from "../../core/types";
import { providerErrorChunksFromMessage, providerErrorChunksFromPayload } from "../errors";
import { geminiCitationGroundingFromCandidate } from "../common/citation-grounding";
import { parseAdapterObjectPayload } from "../common/parse-payload";
import { textOrJsonDelta } from "../common/text-delta";
import { buildUsageChunk } from "../common/usage";
import { asNumber, asString, isRecord, optionalRawChunk } from "../utils";
import { functionCallChunksFromPart } from "./function-call";
import type { GeminiAdapterOptions, ToolState } from "./types";
import { normalizeVertexChunk } from "./vertex";

export class GeminiStreamParser {
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
				];
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
				...geminiCitationGroundingFromCandidate(candidate, {
					emitLegacyCitationMetadata: this.options.emitLegacyCitationMetadata ?? false,
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
		if (functionCall) {
			const result = functionCallChunksFromPart({
				functionCall,
				partIndex,
				choiceIndex,
				tools: this.tools,
				openToolByChoice: this.openToolByChoice,
				toolCounter: this.toolCounter,
			});
			this.toolCounter = result.toolCounter;
			return result.chunks;
		}

		if (Object.keys(part).length === 0) return [];
		return [];
	}
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
