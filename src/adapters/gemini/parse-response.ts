import type { RawChunk } from "../../core/types";
import {
	libraryError,
	providerErrorChunksFromMessage,
	providerErrorChunksFromPayload,
} from "../errors";
import { asString, isRecord } from "../utils";
import { GeminiStreamParser } from "./stream-parser";
import type { GeminiAdapterOptions } from "./types";
import { normalizeVertexChunk } from "./vertex";

export function parseResponse(body: unknown, options: GeminiAdapterOptions): RawChunk[] {
	if (!isRecord(body)) {
		throw libraryError("geminiAdapter.parseResponse expected a GenerateContentResponse object");
	}

	let record = body;
	if (options.apiSurface === "vertex") {
		const normalized = normalizeVertexChunk(body);
		if (normalized) record = normalized;
	}

	const parser = new GeminiStreamParser(options);
	const chunks: RawChunk[] = [];

	if (isRecord(record.error)) {
		return providerErrorChunksFromPayload(
			record.error,
			"geminiAdapter.parseResponse",
			false,
			"Gemini provider error",
		);
	}

	const feedback = isRecord(record.promptFeedback) ? record.promptFeedback : undefined;
	const blockReason = feedback ? asString(feedback.blockReason) : undefined;
	if (blockReason) {
		return providerErrorChunksFromMessage(`Gemini prompt blocked: ${blockReason}`, false);
	}

	chunks.push(...parser.parseChunk(JSON.stringify(record)));

	const hasFinish = chunks.some((chunk) => chunk.kind === "finish");
	if (!hasFinish) {
		chunks.push({ kind: "finish", reason: "stop" });
	}

	return chunks;
}
