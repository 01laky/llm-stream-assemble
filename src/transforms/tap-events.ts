import type { StreamEvent } from "../core/types";

export function tapEvents(
	events: AsyncIterable<StreamEvent>,
	onEvent: (event: StreamEvent) => void,
): AsyncIterable<StreamEvent> {
	return tapEventsGenerator(events, onEvent);
}

async function* tapEventsGenerator(
	events: AsyncIterable<StreamEvent>,
	onEvent: (event: StreamEvent) => void,
): AsyncIterable<StreamEvent> {
	const iterator = events[Symbol.asyncIterator]();
	try {
		while (true) {
			const item = await iterator.next();
			if (item.done) break;
			onEvent(item.value);
			yield item.value;
		}
	} finally {
		await iterator.return?.();
	}
}
