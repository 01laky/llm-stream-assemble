import { notImplemented } from "../helpers/not-implemented";
import type { AssembleOptions, StreamAdapter, StreamEvent } from "./types";

export function assembleResponse(
  _body: unknown,
  _adapter: StreamAdapter,
  _options?: AssembleOptions,
): StreamEvent[] {
  notImplemented("assembleResponse");
}
