import { parsePartialJSON } from "../parse-partial-json";
import type {
	AssembleOptions,
	FinishReason,
	RawChunk,
	ReasoningVariant,
	StreamEvent,
} from "../types";
import { utf8ByteLength } from "../utils/bytes";
import { stripUndefined } from "../utils/object";
import { errorFromUnknown, prefixedError } from "../utils/source";

type TextState = Map<number, string>;

interface ToolState {
	eventId: string;
	name: string;
	args: string;
	index: number | undefined;
	choiceIndex: number | undefined;
	started: boolean;
}

export class EventAssembler {
	private text: TextState = new Map();
	private reasoning = "";
	private reasoningVariant: ReasoningVariant | undefined;
	private refusal = "";
	private json = "";
	private readonly tools = new Map<string, ToolState>();
	private readonly toolByIndex = new Map<string, string>();
	private finishEmitted = false;

	constructor(private readonly options: AssembleOptions = {}) {}

	push(chunk: RawChunk): StreamEvent[] {
		if (this.finishEmitted) return [];

		switch (chunk.kind) {
			case "message-start":
				return [
					optionalEvent({ type: "message.start", id: chunk.id, choiceIndex: chunk.choiceIndex }),
				];
			case "text-delta":
				return this.pushText(chunk.text, chunk.choiceIndex);
			case "reasoning-delta":
				return this.pushReasoning(chunk.text, chunk.variant);
			case "refusal-delta":
				return this.pushRefusal(chunk.text);
			case "json-delta":
				return this.pushJson(chunk.delta);
			case "tool-start":
				return this.pushToolStart(chunk);
			case "tool-args-delta":
				return this.pushToolArgs(chunk);
			case "tool-done":
				return this.finishTool(chunk);
			case "metadata": {
				const { kind: _kind, ...metadata } = chunk;
				return [optionalEvent({ type: "metadata", ...metadata })];
			}
			case "usage": {
				const { kind: _kind, ...usage } = chunk;
				return [optionalEvent({ type: "usage", ...usage })];
			}
			case "finish":
				return chunk.choiceIndex === undefined
					? this.flush({ terminalReason: chunk.reason })
					: this.flush({ terminalReason: chunk.reason, choiceIndex: chunk.choiceIndex });
			case "provider-error":
				return [this.errorEvent(chunk.error, chunk.recoverable)];
		}
	}

	flush(options: { terminalReason?: FinishReason; choiceIndex?: number } = {}): StreamEvent[] {
		const events: StreamEvent[] = [];

		events.push(...this.flushText());
		events.push(...this.flushReasoning());
		events.push(...this.flushRefusal());
		events.push(...this.flushJson());
		events.push(...this.flushTools());

		const forcedError = events.some(
			(event) => event.type === "error" && event.recoverable === false,
		);
		const reason = forcedError ? "error" : options.terminalReason;
		if (reason && !this.finishEmitted) {
			events.push(optionalEvent({ type: "finish", reason, choiceIndex: options.choiceIndex }));
			this.finishEmitted = true;
		}

		return events;
	}

	reset(): void {
		this.text = new Map();
		this.reasoning = "";
		this.reasoningVariant = undefined;
		this.refusal = "";
		this.json = "";
		this.tools.clear();
		this.toolByIndex.clear();
		this.finishEmitted = false;
	}

	hasFinished(): boolean {
		return this.finishEmitted;
	}

	private pushText(text: string, choiceIndex = 0): StreamEvent[] {
		if (text.length === 0) return [];
		const next = `${this.text.get(choiceIndex) ?? ""}${text}`;
		this.assertBuffer(next, "text");
		this.text.set(choiceIndex, next);
		return [
			optionalEvent({ type: "text.delta", text, choiceIndex: normalizeChoiceIndex(choiceIndex) }),
		];
	}

	private pushReasoning(text: string, variant: ReasoningVariant | undefined): StreamEvent[] {
		if (text.length === 0) return [];
		this.reasoning += text;
		this.reasoningVariant = variant ?? this.reasoningVariant;
		this.assertBuffer(this.reasoning, "reasoning");
		return [optionalEvent({ type: "reasoning.delta", text, variant })];
	}

	private pushRefusal(text: string): StreamEvent[] {
		if (text.length === 0) return [];
		this.refusal += text;
		this.assertBuffer(this.refusal, "refusal");
		return [{ type: "refusal.delta", text }];
	}

	private pushJson(delta: string): StreamEvent[] {
		if (delta.length === 0) return [];
		this.json += delta;
		this.assertBuffer(this.json, "json");
		const partial = parsePartialJSON(this.json);
		return [withOptional("partial", partial.value, { type: "json.delta", delta })];
	}

	private pushToolStart(chunk: Extract<RawChunk, { kind: "tool-start" }>): StreamEvent[] {
		const state = this.getOrCreateTool(chunk);
		if (chunk.id && !state.started) {
			state.eventId = chunk.id;
		}
		state.name = chunk.name;
		state.index = chunk.index;
		state.choiceIndex = chunk.choiceIndex;

		if (state.started) return [];
		state.started = true;

		return [
			optionalEvent({
				type: "tool_call.start",
				id: state.eventId,
				name: state.name,
				index: state.index,
				choiceIndex: state.choiceIndex,
			}),
		];
	}

	private pushToolArgs(chunk: Extract<RawChunk, { kind: "tool-args-delta" }>): StreamEvent[] {
		if (chunk.delta.length === 0) return [];
		const state = this.getOrCreateTool(chunk);
		state.args += chunk.delta;
		this.assertBuffer(state.args, "tool args");
		const partial = parsePartialJSON(state.args);
		return [
			withOptional("partial", partial.value, {
				type: "tool_call.args.delta",
				id: state.eventId,
				delta: chunk.delta,
			}),
		];
	}

	private finishTool(chunk: Extract<RawChunk, { kind: "tool-done" }>): StreamEvent[] {
		const state = this.getOrCreateTool(chunk);
		const done = this.toolDoneEvent(state);
		this.deleteTool(state);
		return [done];
	}

	private flushText(): StreamEvent[] {
		const events: StreamEvent[] = [];
		for (const [choiceIndex, text] of this.text) {
			if (text.length > 0) {
				events.push(
					optionalEvent({
						type: "text.done",
						text,
						choiceIndex: normalizeChoiceIndex(choiceIndex),
					}),
				);
			}
		}
		this.text.clear();
		return events;
	}

	private flushReasoning(): StreamEvent[] {
		if (this.reasoning.length === 0) return [];
		const event = optionalEvent({
			type: "reasoning.done",
			text: this.reasoning,
			variant: this.reasoningVariant,
		});
		this.reasoning = "";
		this.reasoningVariant = undefined;
		return [event];
	}

	private flushRefusal(): StreamEvent[] {
		if (this.refusal.length === 0) return [];
		const event: StreamEvent = { type: "refusal.done", text: this.refusal };
		this.refusal = "";
		return [event];
	}

	private flushJson(): StreamEvent[] {
		if (this.json.length === 0) return [];
		const parsed = parsePartialJSON(this.json);
		this.json = "";
		if (parsed.complete) {
			return [{ type: "json.done", value: parsed.value }];
		}
		return [this.errorEvent(prefixedError("json stream ended with invalid JSON"), false)];
	}

	private flushTools(): StreamEvent[] {
		const events: StreamEvent[] = [];
		for (const state of this.tools.values()) {
			events.push(this.toolDoneEvent(state));
		}
		this.tools.clear();
		this.toolByIndex.clear();
		return events;
	}

	private toolDoneEvent(state: ToolState): StreamEvent {
		const parsed = parsePartialJSON(state.args);
		if (parsed.complete) {
			return { type: "tool_call.done", id: state.eventId, name: state.name, args: parsed.value };
		}
		if (this.options.strictToolArgs) {
			throw prefixedError(`tool args for ${state.name} ended with invalid JSON`);
		}
		return { type: "tool_call.done", id: state.eventId, name: state.name, args: state.args };
	}

	private getOrCreateTool(
		chunk: Extract<RawChunk, { kind: "tool-start" | "tool-args-delta" | "tool-done" }>,
	): ToolState {
		const choiceIndex = chunk.choiceIndex ?? 0;
		const indexKey = chunk.index === undefined ? undefined : `${choiceIndex}:${chunk.index}`;
		let key = (indexKey ? this.toolByIndex.get(indexKey) : undefined) || chunk.id;

		if (!key && indexKey) {
			key = `tool:${indexKey}`;
			this.toolByIndex.set(indexKey, key);
		}

		key ??= chunk.id ?? `tool:${choiceIndex}:${this.tools.size}`;

		let state = this.tools.get(key);
		if (!state) {
			state = {
				eventId: chunk.id || key,
				name: "unknown",
				args: "",
				index: chunk.index,
				choiceIndex: normalizeChoiceIndex(choiceIndex),
				started: false,
			};
			this.tools.set(key, state);
		}

		if (chunk.id && !state.started && state.eventId.startsWith("tool:")) {
			this.tools.delete(key);
			state.eventId = chunk.id;
			this.tools.set(chunk.id, state);
			if (indexKey) {
				this.toolByIndex.set(indexKey, chunk.id);
			}
		}

		return state;
	}

	private deleteTool(state: ToolState): void {
		this.tools.delete(state.eventId);
		if (state.index !== undefined) {
			this.toolByIndex.delete(`${state.choiceIndex ?? 0}:${state.index}`);
		}
	}

	private assertBuffer(value: string, label: string): void {
		if (this.options.maxBufferBytes === undefined) return;
		if (utf8ByteLength(value) > this.options.maxBufferBytes) {
			throw prefixedError(`${label} buffer exceeded maxBufferBytes`);
		}
	}

	private errorEvent(error: unknown, recoverable: boolean | undefined): StreamEvent {
		const source = errorFromUnknown(error);
		if (!this.options.sanitizeErrors) {
			return optionalEvent({ type: "error", error: source, recoverable });
		}

		return optionalEvent({
			type: "error",
			error: new Error("An error occurred while processing the stream."),
			recoverable,
			sanitized: "An error occurred while processing the stream.",
		});
	}
}

function optionalEvent(event: Record<string, unknown>): StreamEvent {
	return stripUndefined(
		Object.fromEntries(
			Object.entries(event).filter(([, value]) => value !== undefined && value !== "kind"),
		),
	) as StreamEvent;
}

function withOptional<K extends string, T extends object>(
	key: K,
	value: unknown,
	target: T,
): T & Partial<Record<K, unknown>> {
	if (value === undefined) return target;
	return { ...target, [key]: value } as T & Partial<Record<K, unknown>>;
}

function normalizeChoiceIndex(choiceIndex: number): number | undefined {
	return choiceIndex === 0 ? undefined : choiceIndex;
}
