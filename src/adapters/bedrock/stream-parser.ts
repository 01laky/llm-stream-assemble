import type { RawChunk } from "../../core/types";
import { providerErrorChunksFromPayload } from "../errors";
import { incrementalJsonStringDelta } from "../common/incremental-json";
import { parseAdapterObjectPayload } from "../common/parse-payload";
import { mapAnthropicLikeStopReason } from "../common/stop-reasons";
import { textOrJsonDelta } from "../common/text-delta";
import { buildUsageChunk } from "../common/usage";
import { asNumber, asString, isRecord, optionalRawChunk } from "../utils";
import { EXCEPTION_KEYS, optionalMetadataRaw, reasoningTextFromDelta } from "./helpers";
import type { BedrockAdapterOptions, BlockToolState } from "./types";

export class BedrockStreamParser {
	private messageStarted = false;
	private readonly blocks = new Map<number, BlockToolState>();

	constructor(private readonly options: BedrockAdapterOptions) {}

	parseChunk(raw: string): RawChunk[] {
		const payload = parseAdapterObjectPayload(raw, "bedrockAdapter.parseChunk");
		if (!payload) return [];

		for (const key of EXCEPTION_KEYS) {
			const exception = payload[key];
			if (isRecord(exception)) {
				return providerErrorChunksFromPayload(
					exception,
					"bedrockAdapter.parseChunk",
					false,
					`Bedrock ${key}`,
				);
			}
		}

		if (payload.messageStart !== undefined) {
			return this.messageStartChunks(payload.messageStart);
		}
		if (payload.contentBlockStart !== undefined) {
			return this.contentBlockStartChunks(payload.contentBlockStart);
		}
		if (payload.contentBlockDelta !== undefined) {
			return this.contentBlockDeltaChunks(payload.contentBlockDelta);
		}
		if (payload.contentBlockStop !== undefined) {
			return this.contentBlockStopChunks(payload.contentBlockStop);
		}
		if (payload.messageStop !== undefined) {
			return this.messageStopChunks(payload.messageStop);
		}
		if (payload.metadata !== undefined) {
			return this.metadataChunks(payload.metadata);
		}

		return optionalMetadataRaw(payload);
	}

	private messageStartChunks(value: unknown): RawChunk[] {
		if (!isRecord(value)) return [];
		if (this.messageStarted) return [];
		this.messageStarted = true;
		const role = asString(value.role);
		return [
			{ kind: "message-start" },
			...(role
				? [
						optionalRawChunk({
							kind: "metadata",
							raw: { role },
						}),
					]
				: []),
		];
	}

	private contentBlockStartChunks(value: unknown): RawChunk[] {
		if (!isRecord(value)) return [];
		const blockIndex = asNumber(value.contentBlockIndex) ?? 0;
		const start = isRecord(value.start) ? value.start : undefined;
		const toolUse = start && isRecord(start.toolUse) ? start.toolUse : undefined;
		if (!toolUse) return [];

		const id = asString(toolUse.toolUseId) ?? `bedrock:${blockIndex}`;
		const name = asString(toolUse.name) ?? "unknown";
		this.blocks.set(blockIndex, {
			id,
			name,
			index: blockIndex,
			open: true,
			lastArgsJson: "",
		});
		return [
			optionalRawChunk({
				kind: "tool-start",
				id,
				name,
				index: blockIndex,
				choiceIndex: 0,
			}),
		];
	}

	private contentBlockDeltaChunks(value: unknown): RawChunk[] {
		if (!isRecord(value)) return [];
		const blockIndex = asNumber(value.contentBlockIndex) ?? 0;
		const delta = isRecord(value.delta) ? value.delta : undefined;
		if (!delta) return [];

		const chunks: RawChunk[] = [];
		const text = asString(delta.text);
		const textChunk = text
			? textOrJsonDelta(text, { jsonMode: this.options.jsonMode, choiceIndex: 0 })
			: undefined;
		if (textChunk) chunks.push(textChunk);

		const reasoningText = reasoningTextFromDelta(delta.reasoningContent, this.options.modelFamily);
		if (reasoningText) {
			chunks.push({ kind: "reasoning-delta", text: reasoningText, variant: "detail" });
		}

		const toolUse = isRecord(delta.toolUse) ? delta.toolUse : undefined;
		if (toolUse) {
			chunks.push(...this.toolInputDelta(blockIndex, toolUse));
		}

		return chunks;
	}

	private toolInputDelta(blockIndex: number, toolUse: Record<string, unknown>): RawChunk[] {
		const state = this.blocks.get(blockIndex);
		if (!state) return [];

		const input = toolUse.input;
		let delta: string | undefined;
		if (typeof input === "string") {
			delta = incrementalJsonStringDelta(state, input);
		} else if (isRecord(input)) {
			delta = incrementalJsonStringDelta(state, JSON.stringify(input));
		}
		if (!delta) return [];

		return [
			optionalRawChunk({
				kind: "tool-args-delta",
				id: state.id,
				delta,
				index: state.index,
				choiceIndex: 0,
			}),
		];
	}

	private contentBlockStopChunks(value: unknown): RawChunk[] {
		if (!isRecord(value)) return [];
		const blockIndex = asNumber(value.contentBlockIndex) ?? 0;
		const state = this.blocks.get(blockIndex);
		if (!state?.open) return [];

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

	private messageStopChunks(value: unknown): RawChunk[] {
		if (!isRecord(value)) return [];
		const stopReason = asString(value.stopReason) ?? "unknown";
		const additional = value.additionalModelResponseFields;
		const chunks: RawChunk[] = [];
		chunks.push(
			optionalRawChunk({
				kind: "metadata",
				raw: {
					stopReason,
					...(additional !== undefined ? { additionalModelResponseFields: additional } : {}),
				},
			}),
		);
		chunks.push({
			kind: "finish",
			reason: mapAnthropicLikeStopReason(stopReason),
			choiceIndex: 0,
		});
		return chunks;
	}

	private metadataChunks(value: unknown): RawChunk[] {
		if (!isRecord(value)) return [];
		const chunks: RawChunk[] = [];

		const usage = buildUsageChunk(value.usage, undefined, { mirrorTotalTokens: true });
		if (usage) chunks.push(usage);

		const metrics = value.metrics;
		const trace = value.trace;
		if (metrics !== undefined || trace !== undefined) {
			chunks.push(
				optionalRawChunk({
					kind: "metadata",
					raw: { metrics, trace },
				}),
			);
		}

		return chunks;
	}
}
