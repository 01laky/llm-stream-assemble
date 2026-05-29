import type { RawChunk } from "../../core/types";
import { asNumber, isRecord } from "../utils";
import { messageItemChunks } from "./common";
import type { ResponsesParserContext } from "./types";

export function contentPartChunks(
	context: ResponsesParserContext,
	payload: Record<string, unknown>,
): RawChunk[] {
	const part = isRecord(payload.part)
		? payload.part
		: isRecord(payload.content_part)
			? payload.content_part
			: payload;
	return messageItemChunks(
		{ content: [part] },
		context.options,
		context.logprobPositions,
		asNumber(payload.output_index),
	);
}

export function outputItemMessageChunks(
	context: ResponsesParserContext,
	payload: Record<string, unknown>,
): RawChunk[] {
	const item = isRecord(payload.item) ? payload.item : payload;
	return messageItemChunks(
		item,
		context.options,
		context.logprobPositions,
		asNumber(payload.output_index),
	);
}
