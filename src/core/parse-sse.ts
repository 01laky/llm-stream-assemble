import { notImplementedAsyncIterable } from "../helpers/not-implemented";

export function parseSSE(
  _source: ReadableStream<Uint8Array> | AsyncIterable<string>,
): AsyncIterable<string> {
  return notImplementedAsyncIterable<string>("parseSSE");
}
