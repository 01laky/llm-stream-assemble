import { notImplemented } from "../helpers/not-implemented";
import type { StreamAdapter } from "../core/types";

/** Planned for v0.2 — stub exported for API stability. */
export function openaiResponsesAdapter(): StreamAdapter {
  return {
    parseChunk() {
      notImplemented("openaiResponsesAdapter.parseChunk");
    },
  };
}
