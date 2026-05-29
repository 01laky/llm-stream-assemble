import type { RawChunk } from "../../core/types";
import { libraryError, providerErrorChunksFromPayload } from "../errors";
import { mapAnthropicLikeStopReason } from "../common/stop-reasons";
import { asString, isRecord } from "../utils";
import { EXCEPTION_KEYS } from "./helpers";
import { BedrockStreamParser } from "./stream-parser";
import type { BedrockAdapterOptions } from "./types";

export function parseResponse(body: unknown, options: BedrockAdapterOptions): RawChunk[] {
	if (!isRecord(body)) {
		throw libraryError("bedrockAdapter.parseResponse expected a Converse response object");
	}

	for (const key of EXCEPTION_KEYS) {
		const exception = body[key];
		if (isRecord(exception)) {
			return providerErrorChunksFromPayload(
				exception,
				"bedrockAdapter.parseResponse",
				false,
				`Bedrock ${key}`,
			);
		}
	}

	const parser = new BedrockStreamParser(options);
	const syntheticEvents = synthesizeConverseStreamEvents(body);
	const chunks: RawChunk[] = [];
	for (const event of syntheticEvents) {
		chunks.push(...parser.parseChunk(JSON.stringify(event)));
	}

	const stopReason = asString(body.stopReason);
	if (stopReason) {
		chunks.push({
			kind: "finish",
			reason: mapAnthropicLikeStopReason(stopReason),
			choiceIndex: 0,
		});
	} else if (!chunks.some((chunk) => chunk.kind === "finish")) {
		chunks.push({ kind: "finish", reason: "stop", choiceIndex: 0 });
	}

	return chunks;
}

function synthesizeConverseStreamEvents(body: Record<string, unknown>): unknown[] {
	const events: unknown[] = [];
	const output = isRecord(body.output) ? body.output : undefined;
	const message = output && isRecord(output.message) ? output.message : undefined;

	if (message) {
		events.push({ messageStart: { role: message.role } });
		const content = Array.isArray(message.content) ? message.content : [];
		let blockIndex = 0;
		for (const block of content) {
			if (!isRecord(block)) continue;
			const toolUse = isRecord(block.toolUse) ? block.toolUse : undefined;
			if (toolUse) {
				events.push({
					contentBlockStart: {
						contentBlockIndex: blockIndex,
						start: { toolUse },
					},
				});
				if (toolUse.input !== undefined) {
					events.push({
						contentBlockDelta: {
							contentBlockIndex: blockIndex,
							delta: { toolUse: { input: toolUse.input } },
						},
					});
				}
				events.push({ contentBlockStop: { contentBlockIndex: blockIndex } });
			} else {
				const text = asString(block.text);
				if (text !== undefined && text.length > 0) {
					events.push({
						contentBlockDelta: {
							contentBlockIndex: blockIndex,
							delta: { text },
						},
					});
				}
			}
			blockIndex += 1;
		}
	}

	if (body.usage !== undefined) {
		events.push({ metadata: { usage: body.usage } });
	}

	return events;
}
