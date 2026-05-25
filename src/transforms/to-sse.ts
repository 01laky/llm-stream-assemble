import type { StreamEvent, ToSSEOptions } from "../core/types";

export function toSSE(
	events: AsyncIterable<StreamEvent>,
	options: ToSSEOptions = {},
): ReadableStream<Uint8Array> {
	const iterator = events[Symbol.asyncIterator]();
	const encoder = new TextEncoder();
	let closed = false;

	return new ReadableStream<Uint8Array>({
		async pull(controller) {
			if (closed) return;
			try {
				const item = await iterator.next();
				if (item.done) {
					closed = true;
					controller.close();
					return;
				}

				const event = item.value;
				controller.enqueue(
					encoder.encode(`data: ${JSON.stringify(serializeEvent(event, options))}\n\n`),
				);
				if (event.type === "finish") {
					closed = true;
					await iterator.return?.();
					controller.close();
				}
			} catch (error) {
				closed = true;
				await iterator.return?.();
				controller.error(error);
			}
		},
		async cancel() {
			closed = true;
			await iterator.return?.();
		},
	});
}

function serializeEvent(event: StreamEvent, options: ToSSEOptions): unknown {
	if (event.type !== "error") return event;

	const message = options.sanitizeErrors
		? (event.sanitized ?? "An error occurred while processing the stream.")
		: event.error.message;

	return {
		type: "error",
		error: {
			name: event.error.name,
			message,
		},
		...(event.recoverable === undefined ? {} : { recoverable: event.recoverable }),
		...(event.sanitized === undefined ? {} : { sanitized: event.sanitized }),
	};
}
