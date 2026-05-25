import { describe, expect, it } from "vitest";
import { EventAssembler } from "../src/core/assembler/event-assembler";
import type { StreamEvent } from "../src/core/types";

function pushAll(assembler: EventAssembler, chunks: Parameters<EventAssembler["push"]>[0][]) {
	return chunks.flatMap((chunk) => assembler.push(chunk));
}

describe("EventAssembler", () => {
	it("LSA-C19: emits text deltas and text.done on flush", () => {
		const assembler = new EventAssembler();
		const events = pushAll(assembler, [
			{ kind: "text-delta", text: "Hel" },
			{ kind: "text-delta", text: "lo" },
		]);
		events.push(...assembler.flush());
		expect(events).toEqual([
			{ type: "text.delta", text: "Hel" },
			{ type: "text.delta", text: "lo" },
			{ type: "text.done", text: "Hello" },
		]);
	});

	it("LSA-C20: skips empty text deltas", () => {
		const assembler = new EventAssembler();
		expect(assembler.push({ kind: "text-delta", text: "" })).toEqual([]);
		expect(assembler.flush()).toEqual([]);
	});

	it("LSA-C21: assembles reasoning deltas", () => {
		const assembler = new EventAssembler();
		const events = pushAll(assembler, [
			{ kind: "reasoning-delta", text: "think", variant: "detail" },
			{ kind: "reasoning-delta", text: " more", variant: "detail" },
		]);
		events.push(...assembler.flush());
		expect(events).toEqual([
			{ type: "reasoning.delta", text: "think", variant: "detail" },
			{ type: "reasoning.delta", text: " more", variant: "detail" },
			{ type: "reasoning.done", text: "think more", variant: "detail" },
		]);
	});

	it("LSA-C22: assembles refusal deltas", () => {
		const assembler = new EventAssembler();
		const events = pushAll(assembler, [
			{ kind: "refusal-delta", text: "no" },
			{ kind: "refusal-delta", text: " thanks" },
		]);
		events.push(...assembler.flush());
		expect(events).toEqual([
			{ type: "refusal.delta", text: "no" },
			{ type: "refusal.delta", text: " thanks" },
			{ type: "refusal.done", text: "no thanks" },
		]);
	});

	it("LSA-C23: emits JSON partials and final parsed value", () => {
		const assembler = new EventAssembler();
		const events = pushAll(assembler, [
			{ kind: "json-delta", delta: '{"a":"' },
			{ kind: "json-delta", delta: 'b"}' },
		]);
		events.push(...assembler.flush());
		expect(events).toEqual([
			{ type: "json.delta", delta: '{"a":"', partial: { a: "" } },
			{ type: "json.delta", delta: 'b"}', partial: { a: "b" } },
			{ type: "json.done", value: { a: "b" } },
		]);
	});

	it("LSA-C24: assembles one tool with more than fifty arg deltas", () => {
		const assembler = new EventAssembler();
		const chunks = [
			{ kind: "tool-start" as const, id: "call_many", name: "sum", index: 0 },
			...'{"numbers":[1,2,3],"note":"abcdefghijklmnopqrstuvwxyz"}'
				.split("")
				.map((delta) => ({ kind: "tool-args-delta" as const, id: "call_many", delta, index: 0 })),
			{ kind: "tool-done" as const, id: "call_many", index: 0 },
		];
		const events = pushAll(assembler, chunks);
		expect(events.at(-1)).toEqual({
			type: "tool_call.done",
			id: "call_many",
			name: "sum",
			args: { numbers: [1, 2, 3], note: "abcdefghijklmnopqrstuvwxyz" },
		});
	});

	it("LSA-C25: keeps parallel tools separated by index", () => {
		const assembler = new EventAssembler();
		const events = pushAll(assembler, [
			{ kind: "tool-start", id: "a", name: "first", index: 0 },
			{ kind: "tool-start", id: "b", name: "second", index: 1 },
			{ kind: "tool-args-delta", id: "b", delta: '{"b":2}', index: 1 },
			{ kind: "tool-args-delta", id: "a", delta: '{"a":1}', index: 0 },
			{ kind: "tool-done", id: "a", index: 0 },
			{ kind: "tool-done", id: "b", index: 1 },
		]);
		expect(events.filter((event) => event.type === "tool_call.done")).toEqual([
			{ type: "tool_call.done", id: "a", name: "first", args: { a: 1 } },
			{ type: "tool_call.done", id: "b", name: "second", args: { b: 2 } },
		]);
	});

	it("LSA-C26: keeps tool ids stable when real id arrives after public events", () => {
		const assembler = new EventAssembler();
		const events = pushAll(assembler, [
			{ kind: "tool-start", name: "late", index: 0 },
			{ kind: "tool-args-delta", delta: '{"x":', index: 0 },
			{ kind: "tool-args-delta", id: "real_id", delta: "1}", index: 0 },
			{ kind: "tool-done", id: "real_id", index: 0 },
		]);
		const toolEvents = events.filter((event) => event.type.startsWith("tool_call."));
		expect(new Set(toolEvents.map((event) => ("id" in event ? event.id : undefined)))).toEqual(
			new Set(["tool:0:0"]),
		);
	});

	it("LSA-C27: throws on invalid final tool JSON in strict mode", () => {
		const assembler = new EventAssembler({ strictToolArgs: true });
		assembler.push({ kind: "tool-start", id: "bad", name: "bad" });
		assembler.push({ kind: "tool-args-delta", id: "bad", delta: "{" });
		expect(() => assembler.flush()).toThrow(/^llm-stream-assemble:/);
	});

	it("LSA-C28: preserves unicode in tool args", () => {
		const assembler = new EventAssembler();
		const events = pushAll(assembler, [
			{ kind: "tool-start", id: "unicode", name: "echo" },
			{ kind: "tool-args-delta", id: "unicode", delta: '{"emoji":"😀"}' },
			{ kind: "tool-done", id: "unicode" },
		]);
		expect(events.at(-1)).toEqual({
			type: "tool_call.done",
			id: "unicode",
			name: "echo",
			args: { emoji: "😀" },
		});
	});

	it("LSA-C29: emits message.start and metadata", () => {
		const assembler = new EventAssembler();
		expect(
			pushAll(assembler, [
				{ kind: "message-start", id: "msg_1", choiceIndex: 1 },
				{ kind: "metadata", model: "test", responseId: "resp_1", created: 1 },
			]),
		).toEqual([
			{ type: "message.start", id: "msg_1", choiceIndex: 1 },
			{ type: "metadata", model: "test", responseId: "resp_1", created: 1 },
		]);
	});

	it("LSA-C30: emits usage", () => {
		const assembler = new EventAssembler();
		expect(assembler.push({ kind: "usage", inputTokens: 1, outputTokens: 2 })).toEqual([
			{ type: "usage", inputTokens: 1, outputTokens: 2 },
		]);
	});

	it("LSA-C31: emits provider finish after flushing open content", () => {
		const assembler = new EventAssembler();
		const events = pushAll(assembler, [
			{ kind: "text-delta", text: "done" },
			{ kind: "finish", reason: "stop" },
		]);
		expect(events).toEqual([
			{ type: "text.delta", text: "done" },
			{ type: "text.done", text: "done" },
			{ type: "finish", reason: "stop" },
		]);
	});

	it("LSA-C32: emits provider errors and sanitizes when requested", () => {
		const raw = new EventAssembler().push({
			kind: "provider-error",
			error: new Error("secret upstream message"),
			recoverable: true,
		})[0] as StreamEvent & { type: "error" };
		expect(raw.error.message).toBe("secret upstream message");

		const sanitized = new EventAssembler({ sanitizeErrors: true }).push({
			kind: "provider-error",
			error: new Error("secret upstream message"),
			recoverable: true,
		})[0] as StreamEvent & { type: "error" };
		expect(sanitized.error.message).not.toContain("secret");
		expect(sanitized.sanitized).toBe("An error occurred while processing the stream.");
	});

	it("LSA-C33: accumulates text separately per choiceIndex", () => {
		const assembler = new EventAssembler();
		const events = pushAll(assembler, [
			{ kind: "text-delta", text: "a", choiceIndex: 0 },
			{ kind: "text-delta", text: "b", choiceIndex: 1 },
			{ kind: "text-delta", text: "c", choiceIndex: 1 },
		]);
		events.push(...assembler.flush());
		expect(events).toEqual([
			{ type: "text.delta", text: "a" },
			{ type: "text.delta", text: "b", choiceIndex: 1 },
			{ type: "text.delta", text: "c", choiceIndex: 1 },
			{ type: "text.done", text: "a" },
			{ type: "text.done", text: "bc", choiceIndex: 1 },
		]);
	});

	it("LSA-C34: invalid final JSON emits error and finish error without json.done", () => {
		const assembler = new EventAssembler();
		const events = pushAll(assembler, [{ kind: "json-delta", delta: '{"a":' }]);
		events.push(...assembler.flush({ terminalReason: "stop" }));
		expect(events.some((event) => event.type === "json.done")).toBe(false);
		expect(events.at(-2)?.type).toBe("error");
		expect(events.at(-1)).toEqual({ type: "finish", reason: "error" });
	});

	it("LSA-C35: maxBufferBytes throws when a tool buffer exceeds the limit", () => {
		const assembler = new EventAssembler({ maxBufferBytes: 5 });
		assembler.push({ kind: "tool-start", id: "limited", name: "limited" });
		expect(() =>
			assembler.push({ kind: "tool-args-delta", id: "limited", delta: '{"long":true}' }),
		).toThrow(/^llm-stream-assemble:/);
	});
});
