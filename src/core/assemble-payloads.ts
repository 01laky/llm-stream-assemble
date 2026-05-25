import { notImplementedAsyncIterable } from "../helpers/not-implemented";
import type { AssembleOptions, StreamAdapter, StreamEvent } from "./types";

export function assembleFromPayloads(
  _payloads: AsyncIterable<string>,
  _adapter: StreamAdapter,
  _options?: AssembleOptions,
): AsyncIterable<StreamEvent> {
  return notImplementedAsyncIterable<StreamEvent>("assembleFromPayloads");
}
