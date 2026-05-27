import type { RawChunk, StreamAdapter } from "../core/types";
import { libraryError, providerErrorChunksFromPayload } from "./errors";
import { incrementalJsonStringDelta } from "./shared/incremental-json";
import { parseAdapterObjectPayload } from "./shared/parse-payload";
import { mapAnthropicLikeStopReason } from "./shared/stop-reasons";
import { textOrJsonDelta } from "./shared/text-delta";
import { buildUsageChunk } from "./shared/usage";
import { asNumber, asString, createStreamAdapter, isRecord, optionalRawChunk } from "./utils";

export type BedrockModelFamily = "anthropic" | "openai-like" | "nova" | "auto";

export interface BedrockAdapterOptions {
	/**
	 * Hint which ConverseStream payload dialect to prefer when envelopes overlap.
	 * "auto" uses structural detection (document heuristics in adapter-guide).
	 */
	modelFamily?: BedrockModelFamily;
	/** Map structured JSON text blocks to json-delta instead of text-delta. */
	jsonMode?: boolean;
}

interface BlockToolState {
	id: string;
	name: string;
	index: number;
	open: boolean;
	lastArgsJson: string;
}

const EXCEPTION_KEYS = [
	"internalServerException",
	"modelStreamErrorException",
	"validationException",
	"throttlingException",
	"serviceUnavailableException",
] as const;

export function bedrockAdapter(options: BedrockAdapterOptions = {}): StreamAdapter {
	const parser = new BedrockStreamParser(options);
	return createStreamAdapter({
		parser,
		parseResponse,
		options,
	});
}

class BedrockStreamParser {
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

function parseResponse(body: unknown, options: BedrockAdapterOptions): RawChunk[] {
	if (!isRecord(body)) {
		throw libraryError("bedrockAdapter.parseResponse expected a Converse response object");
	}

	for (const key of EXCEPTION_KEYS) {
		const exception = body[key];
		if (isRecord(exception)) {
			return providerErrorChunksFromPayload(
				exception,
				"bedrockAdapter.parseResponse",
				false,
				`Bedrock ${key}`,
			);
		}
	}

	const parser = new BedrockStreamParser(options);
	const syntheticEvents = synthesizeConverseStreamEvents(body);
	const chunks: RawChunk[] = [];
	for (const event of syntheticEvents) {
		chunks.push(...parser.parseChunk(JSON.stringify(event)));
	}

	const stopReason = asString(body.stopReason);
	if (stopReason) {
		chunks.push({
			kind: "finish",
			reason: mapAnthropicLikeStopReason(stopReason),
			choiceIndex: 0,
		});
	} else if (!chunks.some((chunk) => chunk.kind === "finish")) {
		chunks.push({ kind: "finish", reason: "stop", choiceIndex: 0 });
	}

	return chunks;
}

function synthesizeConverseStreamEvents(body: Record<string, unknown>): unknown[] {
	const events: unknown[] = [];
	const output = isRecord(body.output) ? body.output : undefined;
	const message = output && isRecord(output.message) ? output.message : undefined;

	if (message) {
		events.push({ messageStart: { role: message.role } });
		const content = Array.isArray(message.content) ? message.content : [];
		let blockIndex = 0;
		for (const block of content) {
			if (!isRecord(block)) continue;
			const toolUse = isRecord(block.toolUse) ? block.toolUse : undefined;
			if (toolUse) {
				events.push({
					contentBlockStart: {
						contentBlockIndex: blockIndex,
						start: { toolUse },
					},
				});
				if (toolUse.input !== undefined) {
					events.push({
						contentBlockDelta: {
							contentBlockIndex: blockIndex,
							delta: { toolUse: { input: toolUse.input } },
						},
					});
				}
				events.push({ contentBlockStop: { contentBlockIndex: blockIndex } });
			} else {
				const text = asString(block.text);
				if (text !== undefined && text.length > 0) {
					events.push({
						contentBlockDelta: {
							contentBlockIndex: blockIndex,
							delta: { text },
						},
					});
				}
			}
			blockIndex += 1;
		}
	}

	if (body.usage !== undefined) {
		events.push({ metadata: { usage: body.usage } });
	}

	return events;
}

function reasoningTextFromDelta(
	reasoning: unknown,
	modelFamily: BedrockModelFamily | undefined,
): string | undefined {
	if (reasoning === undefined) return undefined;
	if (typeof reasoning === "string") return reasoning.length > 0 ? reasoning : undefined;
	if (!isRecord(reasoning)) return undefined;

	const text = asString(reasoning.text);
	if (text !== undefined && text.length > 0) return text;

	if (modelFamily === "anthropic" || modelFamily === "auto") {
		const thinking = asString(reasoning.thinking);
		if (thinking !== undefined && thinking.length > 0) return thinking;
	}

	return undefined;
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
