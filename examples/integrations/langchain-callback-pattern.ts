import type { StreamEvent } from "../../src/core/types";

/** LangChain-style handler shape — no langchain package import. */
export interface LangChainStyleHandlers {
	handleLLMNewToken?(token: string): Promise<void> | void;
	handleToolStart?(tool: { name: string; input: string }): Promise<void> | void;
	handleToolEnd?(output: string): Promise<void> | void;
}

export function createLangChainHandlerAdapter(
	handlers: LangChainStyleHandlers,
): (event: StreamEvent) => Promise<void> {
	const toolInputs = new Map<string, string>();

	return async (event: StreamEvent) => {
		switch (event.type) {
			case "text.delta":
				await handlers.handleLLMNewToken?.(event.text);
				return;
			case "tool_call.start": {
				toolInputs.set(event.id, "");
				await handlers.handleToolStart?.({ name: event.name, input: "" });
				return;
			}
			case "tool_call.args.delta": {
				const current = toolInputs.get(event.id) ?? "";
				const next = current + event.delta;
				toolInputs.set(event.id, next);
				await handlers.handleToolStart?.({ name: "", input: next });
				return;
			}
			case "tool_call.done":
				await handlers.handleToolEnd?.(JSON.stringify(event.args));
				toolInputs.delete(event.id);
				return;
			default:
				return;
		}
	};
}

export interface LangChainCallbackExampleOptions {
	events?: StreamEvent[];
	handlers?: LangChainStyleHandlers;
}

export async function runLangChainCallbackExample(
	options: LangChainCallbackExampleOptions = {},
): Promise<void> {
	const events =
		options.events ??
		([
			{ type: "text.delta", text: "Hi" },
			{
				type: "tool_call.start",
				id: "call_1",
				name: "get_weather",
			},
			{ type: "tool_call.args.delta", id: "call_1", delta: "{}" },
			{
				type: "tool_call.done",
				id: "call_1",
				name: "get_weather",
				args: {},
			},
		] as StreamEvent[]);
	const adapter = createLangChainHandlerAdapter(options.handlers ?? {});
	for (const event of events) {
		await adapter(event);
	}
}
