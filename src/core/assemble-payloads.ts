import type { AssembleOptions, StreamAdapter, StreamEvent } from "./types";
import { processPayload, resolveTerminalFlush } from "./assembly/process-payload";
import { EventAssembler } from "./assembler/event-assembler";

export function assembleFromPayloads(
	payloads: AsyncIterable<string>,
	adapter: StreamAdapter,
	options: AssembleOptions = {},
): AsyncIterable<StreamEvent> {
	return assembleFromPayloadsGenerator(payloads, adapter, options);
}

async function* assembleFromPayloadsGenerator(
	payloads: AsyncIterable<string>,
	adapter: StreamAdapter,
	options: AssembleOptions,
): AsyncIterable<StreamEvent> {
	const assembler = new EventAssembler(options);
	const iterator = payloads[Symbol.asyncIterator]();
	let sawTerminalMarker = false;

	try {
		while (true) {
			if (options.signal?.aborted) {
				yield* assembler.flush({ terminalReason: "aborted" });
				return;
			}

			const item = await iterator.next();
			if (item.done) break;

			const result = processPayload(item.value, assembler, adapter, options);
			if (result.kind === "done-marker") {
				sawTerminalMarker = true;
				continue;
			}
			if (result.kind === "recoverable-error") {
				yield result.event;
				continue;
			}
			yield* result.events;
		}

		yield* resolveTerminalFlush(assembler, {
			sawTerminalMarker,
			aborted: options.signal?.aborted === true,
		});
	} finally {
		await iterator.return?.();
	}
}
