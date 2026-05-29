import { describe, expect, it } from "vitest";
import { EventAssembler } from "../src/core/assembler/event-assembler";
import type { StreamEvent } from "../src/core/types";

function pushAll(assembler: EventAssembler, chunks: Parameters<EventAssembler["push"]>[0][]) {
	return chunks.flatMap((chunk) => assembler.push(chunk));
}

describe("EventAssembler extended edge cases", () => {
	it("LSA-C-EXT01: ignores push after terminal finish was emitted", () => {
		const assembler = new EventAssembler();
		assembler.push({ kind: "finish", reason: "stop" });
		expect(assembler.push({ kind: "text-delta", text: "late" })).toEqual([]);
		expect(assembler.hasFinished()).toBe(true);
	});

	it("LSA-C-EXT02: flush without terminalReason emits done events but no finish", () => {
		const assembler = new EventAssembler();
		pushAll(assembler, [{ kind: "text-delta", text: "hi" }]);
		const flushed = assembler.flush();
		expect(flushed).toEqual([{ type: "text.done", text: "hi" }]);
		expect(flushed.some((event) => event.type === "finish")).toBe(false);
		expect(assembler.hasFinished()).toBe(false);
	});

	it("LSA-C-EXT03: flush completes open tool with invalid JSON in non-strict mode", () => {
		const assembler = new EventAssembler();
		pushAll(assembler, [
			{ kind: "tool-start", id: "open", name: "open" },
			{ kind: "tool-args-delta", id: "open", delta: "{" },
		]);
		const flushed = assembler.flush();
		expect(flushed.at(-1)).toEqual({
			type: "tool_call.done",
			id: "open",
			name: "open",
			args: "{",
		});
	});

	it("LSA-C-EXT04: tool_done returns raw string args when JSON is invalid and strictToolArgs is false", () => {
		const assembler = new EventAssembler();
		const events = pushAll(assembler, [
			{ kind: "tool-start", id: "raw", name: "raw" },
			{ kind: "tool-args-delta", id: "raw", delta: "not-json" },
			{ kind: "tool-done", id: "raw" },
		]);
		expect(events.at(-1)).toEqual({
			type: "tool_call.done",
			id: "raw",
			name: "raw",
			args: "not-json",
		});
	});

	it("LSA-C-EXT05: reset clears finished state and allows new events", () => {
		const assembler = new EventAssembler();
		assembler.push({ kind: "finish", reason: "stop" });
		expect(assembler.hasFinished()).toBe(true);
		assembler.reset();
		expect(assembler.hasFinished()).toBe(false);
		const events = pushAll(assembler, [{ kind: "text-delta", text: "again" }]);
		events.push(...assembler.flush({ terminalReason: "stop" }));
		expect(events).toEqual([
			{ type: "text.delta", text: "again" },
			{ type: "text.done", text: "again" },
			{ type: "finish", reason: "stop" },
		]);
	});

	it("LSA-C-EXT06: finish chunk preserves choiceIndex on terminal finish event", () => {
		const assembler = new EventAssembler();
		const events = pushAll(assembler, [{ kind: "finish", reason: "length", choiceIndex: 2 }]);
		expect(events.at(-1)).toEqual({ type: "finish", reason: "length", choiceIndex: 2 });
	});

	it("LSA-C-EXT07: maxBufferBytes applies to text reasoning refusal and json buffers", () => {
		const limit = new EventAssembler({ maxBufferBytes: 4 });
		expect(() => limit.push({ kind: "text-delta", text: "12345" })).toThrow(/text buffer exceeded/);

		const reasoning = new EventAssembler({ maxBufferBytes: 4 });
		expect(() => reasoning.push({ kind: "reasoning-delta", text: "12345" })).toThrow(
			/reasoning buffer exceeded/,
		);

		const refusal = new EventAssembler({ maxBufferBytes: 4 });
		expect(() => refusal.push({ kind: "refusal-delta", text: "12345" })).toThrow(
			/refusal buffer exceeded/,
		);

		const json = new EventAssembler({ maxBufferBytes: 4 });
		expect(() => json.push({ kind: "json-delta", delta: "12345" })).toThrow(/json buffer exceeded/);
	});

	it("LSA-C-EXT08: maxBufferBytes counts UTF-8 bytes not JavaScript string length", () => {
		const assembler = new EventAssembler({ maxBufferBytes: 3 });
		expect(() => assembler.push({ kind: "text-delta", text: "😀" })).toThrow(
			/text buffer exceeded/,
		);
	});

	it("LSA-C-EXT09: reasoning variant persists when later deltas omit variant", () => {
		const assembler = new EventAssembler();
		const events = pushAll(assembler, [
			{ kind: "reasoning-delta", text: "a", variant: "detail" },
			{ kind: "reasoning-delta", text: "b" },
		]);
		events.push(...assembler.flush());
		expect(events).toEqual([
			{ type: "reasoning.delta", text: "a", variant: "detail" },
			{ type: "reasoning.delta", text: "b" },
			{ type: "reasoning.done", text: "ab", variant: "detail" },
		]);
	});

	it("LSA-C-EXT10: duplicate tool-start for same tool does not emit second tool_call.start", () => {
		const assembler = new EventAssembler();
		const events = pushAll(assembler, [
			{ kind: "tool-start", id: "dup", name: "dup", index: 0 },
			{ kind: "tool-start", id: "dup", name: "dup-renamed", index: 0 },
		]);
		expect(events.filter((event) => event.type === "tool_call.start")).toHaveLength(1);
	});

	it("LSA-C-EXT11: json.delta omits partial when content is unrecoverable", () => {
		const assembler = new EventAssembler();
		const event = assembler.push({ kind: "json-delta", delta: "not json" })[0] as StreamEvent & {
			type: "json.delta";
		};
		expect(event.type).toBe("json.delta");
		expect("partial" in event).toBe(false);
	});

	it("LSA-C-EXT12: skips empty reasoning refusal json and tool-args deltas", () => {
		const assembler = new EventAssembler();
		expect(assembler.push({ kind: "reasoning-delta", text: "" })).toEqual([]);
		expect(assembler.push({ kind: "refusal-delta", text: "" })).toEqual([]);
		expect(assembler.push({ kind: "json-delta", delta: "" })).toEqual([]);
		expect(assembler.push({ kind: "tool-args-delta", id: "x", delta: "" })).toEqual([]);
	});

	it("LSA-C-EXT13: provider-error wraps non-Error payloads via errorFromUnknown", () => {
		const assembler = new EventAssembler();
		const event = assembler.push({
			kind: "provider-error",
			error: "plain string failure",
			recoverable: false,
		})[0] as StreamEvent & { type: "error" };
		expect(event.error).toBeInstanceOf(Error);
		expect(event.error.message).toBe("plain string failure");
		expect(event.recoverable).toBe(false);
	});

	it("LSA-C-EXT14: second flush with terminalReason does not duplicate finish", () => {
		const assembler = new EventAssembler();
		assembler.push({ kind: "text-delta", text: "x" });
		const first = assembler.flush({ terminalReason: "stop" });
		const second = assembler.flush({ terminalReason: "stop" });
		expect(first.filter((event) => event.type === "finish")).toHaveLength(1);
		expect(second.filter((event) => event.type === "finish")).toHaveLength(0);
	});

	it("LSA-C-EXT15: tool index keys are isolated per choiceIndex", () => {
		const assembler = new EventAssembler();
		const events = pushAll(assembler, [
			{ kind: "tool-start", id: "c0", name: "a", index: 0, choiceIndex: 0 },
			{ kind: "tool-start", id: "c1", name: "b", index: 0, choiceIndex: 1 },
			{ kind: "tool-args-delta", id: "c0", delta: '{"a":1}', index: 0, choiceIndex: 0 },
			{ kind: "tool-args-delta", id: "c1", delta: '{"b":2}', index: 0, choiceIndex: 1 },
			{ kind: "tool-done", id: "c0", index: 0, choiceIndex: 0 },
			{ kind: "tool-done", id: "c1", index: 0, choiceIndex: 1 },
		]);
		expect(events.filter((event) => event.type === "tool_call.done")).toEqual([
			{ type: "tool_call.done", id: "c0", name: "a", args: { a: 1 } },
			{ type: "tool_call.done", id: "c1", name: "b", args: { b: 2 } },
		]);
	});

	it("LSA-C-EXT16: unrecoverable json flush forces finish reason error", () => {
		const assembler = new EventAssembler();
		pushAll(assembler, [{ kind: "json-delta", delta: "{" }]);
		const events = assembler.flush({ terminalReason: "stop" });
		expect(events.at(-1)).toEqual({ type: "finish", reason: "error" });
	});

	it("LSA-C-EXT17: metadata and usage spread omits kind field", () => {
		const assembler = new EventAssembler();
		expect(
			assembler.push({ kind: "usage", inputTokens: 3, outputTokens: 4, raw: { x: 1 } }),
		).toEqual([{ type: "usage", inputTokens: 3, outputTokens: 4, raw: { x: 1 } }]);
	});

	it("LSA-C-EXT36: tool-done without prior tool-start emits unknown tool_call.done", () => {
		const assembler = new EventAssembler();
		expect(assembler.push({ kind: "tool-done", id: "missing" })).toEqual([
			{ type: "tool_call.done", id: "missing", name: "unknown", args: "" },
		]);
	});

	it("LSA-C-EXT37: flush with aborted terminal reason emits text.done then aborted finish", () => {
		const assembler = new EventAssembler();
		assembler.push({ kind: "text-delta", text: "ab" });
		expect(assembler.flush({ terminalReason: "aborted" })).toEqual([
			{ type: "text.done", text: "ab" },
			{ type: "finish", reason: "aborted" },
		]);
	});

	it("LSA-C-EXT38: message-start passes through id and choiceIndex", () => {
		const assembler = new EventAssembler();
		expect(assembler.push({ kind: "message-start", id: "m38", choiceIndex: 2 })).toEqual([
			{ type: "message.start", id: "m38", choiceIndex: 2 },
		]);
	});
});
