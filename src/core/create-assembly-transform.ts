import type { AssembleOptions, StreamAdapter, StreamEvent } from "./types";
import { processPayload, resolveTerminalFlush } from "./assembly/process-payload";
import { EventAssembler } from "./assembler/event-assembler";
import { Utf8StreamDecoder } from "./utils/bytes";
import { SSEParser } from "./utils/sse-parser";

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

	const handlePayload = (
		payload: string,
		controller: TransformStreamDefaultController<StreamEvent>,
	) => {
		const result = processPayload(payload, assembler, adapter, options);
		if (result.kind === "done-marker") {
			sawTerminalMarker = true;
			return;
		}
		if (result.kind === "recoverable-error") {
			controller.enqueue(result.event);
			return;
		}
		emit(controller, result.events);
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
				handlePayload(payload, controller);
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
					handlePayload(payload, controller);
				}
			}

			for (const payload of parser.flush()) {
				handlePayload(payload, controller);
			}

			emit(controller, resolveTerminalFlush(assembler, { sawTerminalMarker, aborted: false }));
		},
	});
}
