import type { EventAssembler } from "../assembler/event-assembler";
import type { AssembleOptions, StreamAdapter, StreamEvent } from "../types";
import { errorFromUnknown, prefixedError } from "../utils/source";

export type ProcessPayloadResult =
	| { kind: "done-marker" }
	| { kind: "events"; events: StreamEvent[] }
	| { kind: "recoverable-error"; event: StreamEvent };

export function isDoneMarker(payload: string): boolean {
	return payload.trim() === "[DONE]";
}

export function processPayload(
	payload: string,
	assembler: EventAssembler,
	adapter: StreamAdapter,
	options: AssembleOptions,
): ProcessPayloadResult {
	if (isDoneMarker(payload)) {
		return { kind: "done-marker" };
	}

	let chunks;
	try {
		chunks = adapter.parseChunk(payload);
	} catch (error) {
		if (!options.recoverMalformed) {
			throw error;
		}
		return {
			kind: "recoverable-error",
			event: {
				type: "error",
				error: prefixedError(errorFromUnknown(error).message),
				recoverable: true,
			},
		};
	}

	const events: StreamEvent[] = [];
	for (const chunk of chunks) {
		events.push(...assembler.push(chunk));
	}
	return { kind: "events", events };
}

export function resolveTerminalFlush(
	assembler: EventAssembler,
	state: { sawTerminalMarker: boolean; aborted: boolean },
): StreamEvent[] {
	if (state.aborted) {
		return assembler.flush({ terminalReason: "aborted" });
	}
	if (state.sawTerminalMarker) {
		return assembler.flush({ terminalReason: "stop" });
	}
	if (assembler.hasFinished()) {
		return assembler.flush();
	}
	return assembler.flush({ terminalReason: "incomplete" });
}
