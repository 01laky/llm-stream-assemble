import { notImplemented } from "../helpers/not-implemented";
import type { StreamAdapter } from "../core/types";

export function openaiChatAdapter(): StreamAdapter {
	return {
		parseChunk() {
			notImplemented("openaiChatAdapter.parseChunk");
		},
	};
}
