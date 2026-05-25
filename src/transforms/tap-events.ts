import { notImplementedAsyncIterable } from "../helpers/not-implemented";
import type { StreamEvent } from "../core/types";

export function tapEvents(
  _events: AsyncIterable<StreamEvent>,
  _onEvent: (event: StreamEvent) => void,
): AsyncIterable<StreamEvent> {
  return notImplementedAsyncIterable<StreamEvent>("tapEvents");
}
