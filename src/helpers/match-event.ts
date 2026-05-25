import type { StreamEvent, StreamEventHandlers } from "../core/types";

export function matchEvent<R>(event: StreamEvent, handlers: StreamEventHandlers<R>): R | undefined {
  switch (event.type) {
    case "message.start":
      return handlers["message.start"]?.(event);
    case "metadata":
      return handlers.metadata?.(event);
    case "text.delta":
      return handlers["text.delta"]?.(event);
    case "text.done":
      return handlers["text.done"]?.(event);
    case "reasoning.delta":
      return handlers["reasoning.delta"]?.(event);
    case "reasoning.done":
      return handlers["reasoning.done"]?.(event);
    case "refusal.delta":
      return handlers["refusal.delta"]?.(event);
    case "refusal.done":
      return handlers["refusal.done"]?.(event);
    case "json.delta":
      return handlers["json.delta"]?.(event);
    case "json.done":
      return handlers["json.done"]?.(event);
    case "tool_call.start":
      return handlers["tool_call.start"]?.(event);
    case "tool_call.args.delta":
      return handlers["tool_call.args.delta"]?.(event);
    case "tool_call.done":
      return handlers["tool_call.done"]?.(event);
    case "usage":
      return handlers.usage?.(event);
    case "finish":
      return handlers.finish?.(event);
    case "error":
      return handlers.error?.(event);
    default: {
      const _exhaustive: never = event;
      return _exhaustive;
    }
  }
}
