import type { AssembleOptions, StreamAdapter, StreamEvent } from "./types";
import { EventAssembler } from "./assembler/event-assembler";
import { prefixedError } from "./utils/source";

export function assembleResponse(
	body: unknown,
	adapter: StreamAdapter,
	options: AssembleOptions = {},
): StreamEvent[] {
	if (!adapter.parseResponse) {
		throw prefixedError("adapter.parseResponse is required for assembleResponse");
	}

	const assembler = new EventAssembler(options);
	const events: StreamEvent[] = [];

	for (const chunk of adapter.parseResponse(body)) {
		events.push(...assembler.push(chunk));
	}

	events.push(...assembler.flush(assembler.hasFinished() ? undefined : { terminalReason: "stop" }));
	return events;
}
