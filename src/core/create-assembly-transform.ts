import type { AssembleOptions, StreamAdapter, StreamEvent } from "./types";
import { EventAssembler } from "./assembler/event-assembler";
import { Utf8StreamDecoder } from "./utils/bytes";
import { SSEParser } from "./utils/sse-parser";
import { errorFromUnknown, prefixedError } from "./utils/source";

export function createAssemblyTransform(
	adapter: StreamAdapter,
	options: AssembleOptions = {},
): TransformStream<Uint8Array, StreamEvent> {
	const decoder = new Utf8StreamDecoder();
	const parser = new SSEParser();
	const assembler = new EventAssembler(options);
	let sawTerminalMarker = false;
	let aborted = false;

	const emit = (
		controller: TransformStreamDefaultController<StreamEvent>,
		events: StreamEvent[],
	) => {
		for (const event of events) {
			controller.enqueue(event);
		}
	};

	const processPayload = (
		payload: string,
		controller: TransformStreamDefaultController<StreamEvent>,
	) => {
		if (payload.trim() === "[DONE]") {
			sawTerminalMarker = true;
			return;
		}

		let chunks;
		try {
			chunks = adapter.parseChunk(payload);
		} catch (error) {
			if (!options.recoverMalformed) {
				throw error;
			}
			controller.enqueue({
				type: "error",
				error: prefixedError(errorFromUnknown(error).message),
				recoverable: true,
			});
			return;
		}

		for (const chunk of chunks) {
			emit(controller, assembler.push(chunk));
		}
	};

	return new TransformStream<Uint8Array, StreamEvent>({
		start(controller) {
			options.signal?.addEventListener(
				"abort",
				() => {
					if (aborted || assembler.hasFinished()) return;
					aborted = true;
					emit(controller, assembler.flush({ terminalReason: "aborted" }));
					controller.terminate();
				},
				{ once: true },
			);
		},
		transform(chunk, controller) {
			if (aborted || options.signal?.aborted) {
				aborted = true;
				emit(controller, assembler.flush({ terminalReason: "aborted" }));
				controller.terminate();
				return;
			}

			for (const payload of parser.push(decoder.decode(chunk))) {
				processPayload(payload, controller);
			}
		},
		flush(controller) {
			if (aborted || options.signal?.aborted) {
				emit(controller, assembler.flush({ terminalReason: "aborted" }));
				return;
			}

			const decoded = decoder.flush();
			if (decoded.length > 0) {
				for (const payload of parser.push(decoded)) {
					processPayload(payload, controller);
				}
			}

			for (const payload of parser.flush()) {
				processPayload(payload, controller);
			}

			if (sawTerminalMarker) {
				emit(controller, assembler.flush({ terminalReason: "stop" }));
			} else if (assembler.hasFinished()) {
				emit(controller, assembler.flush());
			} else {
				emit(controller, assembler.flush({ terminalReason: "incomplete" }));
			}
		},
	});
}
