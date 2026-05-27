import type { FinishReason, RawChunk, StreamAdapter } from "../core/types";
import { libraryError, providerErrorChunksFromPayload } from "./errors";
import {
	asNumber,
	asString,
	createStreamAdapter,
	isRecord,
	optionalRawChunk,
	parseAdapterJSON,
} from "./utils";

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
		const trimmed = raw.trim();
		if (trimmed.length === 0 || trimmed === "[DONE]") return [];

		const payload = parseAdapterJSON(trimmed, "bedrockAdapter.parseChunk");
		if (!isRecord(payload)) {
			throw libraryError("bedrockAdapter.parseChunk expected a JSON object");
		}

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
		if (text !== undefined && text.length > 0) {
			if (this.options.jsonMode) {
				chunks.push({ kind: "json-delta", delta: text });
			} else {
				chunks.push({ kind: "text-delta", text, choiceIndex: 0 });
			}
		}

		const reasoning = delta.reasoningContent;
		const reasoningText = reasoningTextFromDelta(reasoning, this.options.modelFamily);
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
			delta = incrementalArgsDelta(state, input);
		} else if (isRecord(input)) {
			delta = incrementalArgsDelta(state, JSON.stringify(input));
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
		chunks.push({ kind: "finish", reason: mapStopReason(stopReason), choiceIndex: 0 });
		return chunks;
	}

	private metadataChunks(value: unknown): RawChunk[] {
		if (!isRecord(value)) return [];
		const chunks: RawChunk[] = [];

		const usage = usageChunk(value.usage);
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
	const chunks: RawChunk[] = [];

	const output = isRecord(body.output) ? body.output : undefined;
	const message = output && isRecord(output.message) ? output.message : undefined;
	if (message) {
		chunks.push({ kind: "message-start" });
		const role = asString(message.role);
		if (role) {
			chunks.push(optionalRawChunk({ kind: "metadata", raw: { role } }));
		}

		const content = Array.isArray(message.content) ? message.content : [];
		let blockIndex = 0;
		for (const block of content) {
			if (!isRecord(block)) continue;
			const text = asString(block.text);
			if (text !== undefined && text.length > 0) {
				if (options.jsonMode) {
					chunks.push({ kind: "json-delta", delta: text });
				} else {
					chunks.push({ kind: "text-delta", text, choiceIndex: 0 });
				}
			}

			const toolUse = isRecord(block.toolUse) ? block.toolUse : undefined;
			if (toolUse) {
				const id = asString(toolUse.toolUseId) ?? `bedrock:${blockIndex}`;
				const name = asString(toolUse.name) ?? "unknown";
				chunks.push(
					optionalRawChunk({
						kind: "tool-start",
						id,
						name,
						index: blockIndex,
						choiceIndex: 0,
					}),
				);
				const input = toolUse.input;
				if (input !== undefined) {
					const argsJson = typeof input === "string" ? input : JSON.stringify(input);
					if (argsJson.length > 0) {
						chunks.push(
							optionalRawChunk({
								kind: "tool-args-delta",
								id,
								delta: argsJson,
								index: blockIndex,
								choiceIndex: 0,
							}),
						);
					}
				}
				chunks.push(
					optionalRawChunk({
						kind: "tool-done",
						id,
						index: blockIndex,
						choiceIndex: 0,
					}),
				);
			}
			blockIndex += 1;
		}
	}

	const usage = usageChunk(body.usage);
	if (usage) chunks.push(usage);

	const stopReason = asString(body.stopReason);
	if (stopReason) {
		chunks.push({ kind: "finish", reason: mapStopReason(stopReason), choiceIndex: 0 });
	} else if (!chunks.some((chunk) => chunk.kind === "finish")) {
		chunks.push({ kind: "finish", reason: "stop" });
	}

	// Touch parser options for modelFamily-specific paths in stream mode parity.
	void parser;

	return chunks;
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

function incrementalArgsDelta(state: BlockToolState, nextInput: string): string | undefined {
	const prev = state.lastArgsJson;
	if (nextInput === prev) return undefined;
	let delta: string;
	if (prev.length > 0 && nextInput.startsWith(prev)) {
		delta = nextInput.slice(prev.length);
	} else {
		delta = nextInput;
	}
	state.lastArgsJson = nextInput;
	return delta.length > 0 ? delta : undefined;
}

function mapStopReason(value: string): FinishReason {
	switch (value) {
		case "end_turn":
		case "stop_sequence":
			return "stop";
		case "tool_use":
			return "tool_calls";
		case "max_tokens":
			return "length";
		case "content_filtered":
		case "guardrail_intervened":
			return "content_filter";
		default:
			return "stop";
	}
}

function usageChunk(value: unknown): RawChunk | undefined {
	if (!isRecord(value)) return undefined;
	const inputTokens =
		asNumber(value.inputTokens) ?? asNumber(value.promptTokens) ?? asNumber(value.inputTokenCount);
	const outputTokens =
		asNumber(value.outputTokens) ??
		asNumber(value.completionTokens) ??
		asNumber(value.outputTokenCount);
	const totalTokens = asNumber(value.totalTokens) ?? asNumber(value.totalTokenCount);
	if (inputTokens === undefined && outputTokens === undefined && totalTokens === undefined) {
		return undefined;
	}
	return optionalRawChunk({
		kind: "usage",
		inputTokens,
		outputTokens,
		raw: { ...value, totalTokens },
	});
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
