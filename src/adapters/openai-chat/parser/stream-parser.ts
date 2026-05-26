import type { RawChunk } from "../../../core/types";
import { asNumber, asString, isRecord, parseAdapterJSON } from "../../utils";
import {
	openAIProviderErrorChunks,
	providerErrorPayload,
	throwAdapterObjectError,
	throwUnrecognizedChunkError,
} from "./errors";
import {
	choiceIndexFor,
	choiceKey,
	finishReasonChunks,
	hasMetadata,
	metadataChunks,
	reasoningChunks,
	toolArgsChunk,
	toolKey,
	toolStartChunk,
	usageChunk,
	withChoiceIndex,
} from "./chunks";
import type { RequiredOpenAIChatLikeParserOptions, ToolState } from "./types";

export class OpenAIChatLikeParser {
	private metadataEmitted = false;
	private readonly tools = new Map<string, ToolState>();
	private readonly legacyStarted = new Set<string>();

	constructor(private readonly options: RequiredOpenAIChatLikeParserOptions) {}

	parseChunk(raw: string): RawChunk[] {
		if (raw.trim() === "[DONE]") return [];

		const payload = parseAdapterJSON(raw, `${this.options.errorPrefix}.parseChunk`);
		if (!isRecord(payload)) {
			throwAdapterObjectError(`${this.options.errorPrefix}.parseChunk`);
		}

		const looseError = providerErrorPayload(payload, this.options);
		if (looseError) return openAIProviderErrorChunks(looseError, false, this.options);

		if (!this.options.looseErrorShape && asString(payload.error) && !isRecord(payload.error)) {
			return [];
		}

		if (this.options.rejectUnrecognizedPayloads && !this.isRecognizableChunk(payload)) {
			throwUnrecognizedChunkError(this.options);
		}

		const chunks: RawChunk[] = [];
		if (!this.metadataEmitted && hasMetadata(payload)) {
			chunks.push(...metadataChunks(payload));
			this.metadataEmitted = true;
		}

		const usage = usageChunk(payload.usage, this.options);
		if (usage) chunks.push(usage);

		const choices = Array.isArray(payload.choices) ? payload.choices : [];
		for (let position = 0; position < choices.length; position += 1) {
			const choice = choices[position];
			if (!isRecord(choice)) continue;
			chunks.push(...this.choiceChunks(choice, position));
		}

		return chunks;
	}

	private isRecognizableChunk(payload: Record<string, unknown>): boolean {
		return (
			hasMetadata(payload) ||
			typeof payload.object === "string" ||
			Array.isArray(payload.choices) ||
			isRecord(payload.usage)
		);
	}

	private choiceChunks(choice: Record<string, unknown>, position: number): RawChunk[] {
		const choiceIndex = choiceIndexFor(choice, position, this.options);
		const chunks: RawChunk[] = [];
		const delta = isRecord(choice.delta) ? choice.delta : undefined;

		if (delta) {
			chunks.push(...this.deltaChunks(delta, choiceIndex, position));
		}

		chunks.push(...finishReasonChunks(choice.finish_reason, choiceIndex, this.options));
		return chunks;
	}

	private deltaChunks(
		delta: Record<string, unknown>,
		choiceIndex: number | undefined,
		choicePosition: number,
	): RawChunk[] {
		const chunks: RawChunk[] = [];
		const content = asString(delta.content);
		if (content && content.length > 0) {
			chunks.push(
				this.options.jsonMode
					? { kind: "json-delta", delta: content }
					: withChoiceIndex({ kind: "text-delta", text: content }, choiceIndex),
			);
		}

		const refusal = asString(delta.refusal);
		if (refusal && refusal.length > 0) {
			chunks.push({ kind: "refusal-delta", text: refusal });
		}

		chunks.push(...reasoningChunks(delta, this.options));
		chunks.push(...this.toolCallChunks(delta.tool_calls, choiceIndex, choicePosition));
		chunks.push(...this.legacyFunctionChunks(delta.function_call, choiceIndex, choicePosition));
		return chunks;
	}

	private toolCallChunks(
		value: unknown,
		choiceIndex: number | undefined,
		choicePosition: number,
	): RawChunk[] {
		if (!Array.isArray(value)) return [];
		const chunks: RawChunk[] = [];

		for (let position = 0; position < value.length; position += 1) {
			const toolCall = value[position];
			if (!isRecord(toolCall)) continue;

			const toolIndex = asNumber(toolCall.index) ?? position;
			const key = toolKey(choiceIndex, choicePosition, toolIndex);
			const state = this.toolState(key);
			const id = asString(toolCall.id);
			const fn = isRecord(toolCall.function) ? toolCall.function : undefined;
			const name = asString(fn?.name);
			const args = asString(fn?.arguments);

			if (id) state.id = id;
			if (name) state.name = name;

			if (!state.startEmitted && (id || name || (args && args.length > 0))) {
				chunks.push(
					toolStartChunk({
						id: state.id,
						name: state.name,
						index: toolIndex,
						choiceIndex,
					}),
				);
				state.startEmitted = true;
			}

			if (args && args.length > 0) {
				state.sawArguments = true;
				chunks.push(
					toolArgsChunk({
						id: state.id,
						delta: args,
						index: toolIndex,
						choiceIndex,
					}),
				);
			}
		}

		return chunks;
	}

	private legacyFunctionChunks(
		value: unknown,
		choiceIndex: number | undefined,
		choicePosition: number,
	): RawChunk[] {
		if (!isRecord(value)) return [];
		const chunks: RawChunk[] = [];
		const name = asString(value.name);
		const args = asString(value.arguments);
		const legacyKey = choiceKey(choiceIndex, choicePosition);
		const id = `${this.options.legacyFunctionIdPrefix}:${choiceIndex ?? choicePosition}`;

		if (name && !this.legacyStarted.has(legacyKey)) {
			chunks.push(withChoiceIndex({ kind: "tool-start", id, name, index: 0 }, choiceIndex));
			this.legacyStarted.add(legacyKey);
		}

		if (args && args.length > 0) {
			if (!this.legacyStarted.has(legacyKey)) {
				chunks.push(
					withChoiceIndex(
						{ kind: "tool-start", id, name: name ?? "unknown", index: 0 },
						choiceIndex,
					),
				);
				this.legacyStarted.add(legacyKey);
			}
			chunks.push(
				withChoiceIndex({ kind: "tool-args-delta", id, delta: args, index: 0 }, choiceIndex),
			);
		}

		return chunks;
	}

	private toolState(key: string): ToolState {
		let state = this.tools.get(key);
		if (!state) {
			state = { name: "unknown", startEmitted: false, sawArguments: false };
			this.tools.set(key, state);
		}
		return state;
	}
}
