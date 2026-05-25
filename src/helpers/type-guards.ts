import type { StreamEvent } from "../core/types";

export function isMessageStart(
  event: StreamEvent,
): event is Extract<StreamEvent, { type: "message.start" }> {
  return event.type === "message.start";
}

export function isMetadata(
  event: StreamEvent,
): event is Extract<StreamEvent, { type: "metadata" }> {
  return event.type === "metadata";
}

export function isTextDelta(
  event: StreamEvent,
): event is Extract<StreamEvent, { type: "text.delta" }> {
  return event.type === "text.delta";
}

export function isTextDone(
  event: StreamEvent,
): event is Extract<StreamEvent, { type: "text.done" }> {
  return event.type === "text.done";
}

export function isReasoningDelta(
  event: StreamEvent,
): event is Extract<StreamEvent, { type: "reasoning.delta" }> {
  return event.type === "reasoning.delta";
}

export function isReasoningDone(
  event: StreamEvent,
): event is Extract<StreamEvent, { type: "reasoning.done" }> {
  return event.type === "reasoning.done";
}

export function isRefusalDelta(
  event: StreamEvent,
): event is Extract<StreamEvent, { type: "refusal.delta" }> {
  return event.type === "refusal.delta";
}

export function isRefusalDone(
  event: StreamEvent,
): event is Extract<StreamEvent, { type: "refusal.done" }> {
  return event.type === "refusal.done";
}

export function isJsonDelta(
  event: StreamEvent,
): event is Extract<StreamEvent, { type: "json.delta" }> {
  return event.type === "json.delta";
}

export function isJsonDone(
  event: StreamEvent,
): event is Extract<StreamEvent, { type: "json.done" }> {
  return event.type === "json.done";
}

export function isToolCallStart(
  event: StreamEvent,
): event is Extract<StreamEvent, { type: "tool_call.start" }> {
  return event.type === "tool_call.start";
}

export function isToolCallArgsDelta(
  event: StreamEvent,
): event is Extract<StreamEvent, { type: "tool_call.args.delta" }> {
  return event.type === "tool_call.args.delta";
}

export function isToolCallDone(
  event: StreamEvent,
): event is Extract<StreamEvent, { type: "tool_call.done" }> {
  return event.type === "tool_call.done";
}

export function isUsage(event: StreamEvent): event is Extract<StreamEvent, { type: "usage" }> {
  return event.type === "usage";
}

export function isFinish(event: StreamEvent): event is Extract<StreamEvent, { type: "finish" }> {
  return event.type === "finish";
}

export function isError(event: StreamEvent): event is Extract<StreamEvent, { type: "error" }> {
  return event.type === "error";
}
