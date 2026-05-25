import type { CollectedStream, StreamEvent } from "../core/types";

export async function collectStream(events: AsyncIterable<StreamEvent>): Promise<CollectedStream> {
	const result: CollectedStream = {
		text: "",
		reasoning: "",
		refusals: "",
		json: undefined,
		toolCalls: [],
	};
	const iterator = events[Symbol.asyncIterator]();

	try {
		while (true) {
			const item = await iterator.next();
			if (item.done) break;
			collectEvent(result, item.value);
		}
		return result;
	} catch (error) {
		await iterator.return?.();
		throw error;
	}
}

function collectEvent(result: CollectedStream, event: StreamEvent): void {
	switch (event.type) {
		case "text.delta":
			result.text += event.text;
			break;
		case "text.done":
			result.text = preferDone(result.text, event.text);
			break;
		case "reasoning.delta":
			result.reasoning += event.text;
			break;
		case "reasoning.done":
			result.reasoning = preferDone(result.reasoning, event.text);
			break;
		case "refusal.delta":
			result.refusals += event.text;
			break;
		case "refusal.done":
			result.refusals = preferDone(result.refusals, event.text);
			break;
		case "json.done":
			result.json = event.value;
			break;
		case "tool_call.done":
			result.toolCalls.push({ id: event.id, name: event.name, args: event.args });
			break;
		case "usage":
			result.usage = event;
			break;
		case "finish":
			result.finishReason = event;
			break;
		case "error":
			if (event.recoverable !== true) throw event.error;
			break;
		default:
			break;
	}
}

function preferDone(current: string, done: string): string {
	if (current === "" || current === done || done.startsWith(current)) return done;
	if (current.endsWith(done)) return current;
	return done;
}
