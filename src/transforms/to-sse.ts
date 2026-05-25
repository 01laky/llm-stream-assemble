import { notImplemented } from "../helpers/not-implemented";
import type { StreamEvent, ToSSEOptions } from "../core/types";

export function toSSE(
	_events: AsyncIterable<StreamEvent>,
	_options?: ToSSEOptions,
): ReadableStream<Uint8Array> {
	notImplemented("toSSE");
}
