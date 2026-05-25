import { notImplemented } from "../helpers/not-implemented";
import type { StreamAdapter } from "../core/types";

export function openaiCompatibleAdapter(): StreamAdapter {
  return {
    parseChunk() {
      notImplemented("openaiCompatibleAdapter.parseChunk");
    },
  };
}
