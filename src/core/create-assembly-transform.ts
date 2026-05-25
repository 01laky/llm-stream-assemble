import { notImplemented } from "../helpers/not-implemented";
import type { AssembleOptions, StreamAdapter, StreamEvent } from "./types";

export function createAssemblyTransform(
  _adapter: StreamAdapter,
  _options?: AssembleOptions,
): TransformStream<Uint8Array, StreamEvent> {
  notImplemented("createAssemblyTransform");
}
