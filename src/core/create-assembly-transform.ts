import type { AssembleOptions, StreamAdapter, StreamEvent } from "./types";
import { AssemblySession } from "./assembly/session";
import { Utf8StreamDecoder } from "./utils/bytes";
import { SSEParser } from "./utils/sse-parser";

export function createAssemblyTransform(
	adapter: StreamAdapter,
	options: AssembleOptions = {},
): TransformStream<Uint8Array, StreamEvent> {
	const decoder = new Utf8StreamDecoder();
	const parser = new SSEParser();
	const session = AssemblySession.create(adapter, options);

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
		emit(controller, session.handlePayload(payload));
	};

	return new TransformStream<Uint8Array, StreamEvent>({
		start(controller) {
			options.signal?.addEventListener(
				"abort",
				() => {
					if (session.isAborted() || session.assembler.hasFinished()) return;
					session.markAborted();
					emit(controller, session.terminalFlush());
					controller.terminate();
				},
				{ once: true },
			);
		},
		transform(chunk, controller) {
			if (session.isAborted()) {
				session.markAborted();
				emit(controller, session.terminalFlush());
				controller.terminate();
				return;
			}

			for (const payload of parser.push(decoder.decode(chunk))) {
				handlePayload(payload, controller);
			}
		},
		flush(controller) {
			if (session.isAborted()) {
				emit(controller, session.terminalFlush());
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

			emit(controller, session.terminalFlush());
		},
	});
}
