import type { AssembleOptions, StreamAdapter, StreamEvent } from "./types";
import { EventAssembler } from "./assembler/event-assembler";
import { errorFromUnknown, prefixedError } from "./utils/source";

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

			const payload = item.value;
			if (payload.trim() === "[DONE]") {
				sawTerminalMarker = true;
				continue;
			}

			let chunks;
			try {
				chunks = adapter.parseChunk(payload);
			} catch (error) {
				if (!options.recoverMalformed) {
					throw error;
				}

				yield {
					type: "error",
					error: prefixedError(errorFromUnknown(error).message),
					recoverable: true,
				};
				continue;
			}

			for (const chunk of chunks) {
				yield* assembler.push(chunk);
			}
		}

		if (options.signal?.aborted) {
			yield* assembler.flush({ terminalReason: "aborted" });
		} else if (sawTerminalMarker) {
			yield* assembler.flush({ terminalReason: "stop" });
		} else if (assembler.hasFinished()) {
			yield* assembler.flush();
		} else {
			yield* assembler.flush({ terminalReason: "incomplete" });
		}
	} finally {
		await iterator.return?.();
	}
}
