import { notImplemented } from "../helpers/not-implemented";
import type { CollectedStream, StreamEvent } from "../core/types";

export async function collectStream(
  _events: AsyncIterable<StreamEvent>,
): Promise<CollectedStream> {
  notImplemented("collectStream");
}
