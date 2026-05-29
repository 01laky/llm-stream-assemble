import type { RawChunk } from "../../core/types";
import { libraryError } from "../errors";
import { createLogprobPositionState } from "../common/logprobs";
import { asString, isRecord } from "../utils";
import {
	errorMessage,
	isErrorPayload,
	metadataChunks,
	messageItemChunks,
	providerErrorChunks,
	usageFromResponse,
} from "./common";
import type { OpenAIResponsesAdapterOptions } from "./types";

export function parseResponse(body: unknown, options: OpenAIResponsesAdapterOptions): RawChunk[] {
	if (!isRecord(body)) {
		throw libraryError("openaiResponsesAdapter.parseResponse expected an OpenAI Responses object");
	}
	if (isErrorPayload(body) || asString(body.status) === "failed") {
		return providerErrorChunks(errorMessage(body));
	}

	const positionState = createLogprobPositionState();
	const chunks: RawChunk[] = [];
	chunks.push(...metadataChunks(body));
	const output = Array.isArray(body.output) ? body.output : [];
	for (let index = 0; index < output.length; index += 1) {
		const item = output[index];
		if (!isRecord(item)) continue;
		if (asString(item.type) === "function_call") {
			const id = asString(item.call_id) ?? asString(item.id) ?? `response_tool:${index}`;
			const name = asString(item.name) ?? "unknown";
			chunks.push({ kind: "tool-start", id, name, index });
			const args = asString(item.arguments);
			if (args) chunks.push({ kind: "tool-args-delta", id, delta: args, index });
			chunks.push({ kind: "tool-done", id, index });
		} else {
			chunks.push(...messageItemChunks(item, options, positionState));
		}
	}
	chunks.push(...usageFromResponse(body));
	const status = asString(body.status);
	if (status === "incomplete") chunks.push({ kind: "finish", reason: "incomplete" });
	else chunks.push({ kind: "finish", reason: "stop" });
	return chunks;
}
