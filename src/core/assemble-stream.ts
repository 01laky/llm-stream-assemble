import { notImplementedAsyncIterable } from "../helpers/not-implemented";
import type { AssembleOptions, StreamAdapter, StreamEvent } from "./types";

export function assembleStream(
  _source: ReadableStream<Uint8Array> | AsyncIterable<string>,
  _adapter: StreamAdapter,
  _options?: AssembleOptions,
): AsyncIterable<StreamEvent> {
  return notImplementedAsyncIterable<StreamEvent>("assembleStream");
}
