import type { RawChunk } from "../../core/types";
import { libraryError, providerErrorChunksFromPayload } from "../errors";
import { buildUsageChunk } from "../common/usage";
import { asString, isRecord } from "../utils";
import { mapCohereFinishReason } from "./finish-reason";
import { toolCallsFromRecord } from "./helpers";
import { CohereStreamParser } from "./stream-parser";
import { COHERE_USAGE_ALIASES, type CohereAdapterOptions } from "./types";

export function parseResponse(body: unknown, options: CohereAdapterOptions): RawChunk[] {
	if (!isRecord(body)) {
		throw libraryError("cohereAdapter.parseResponse expected a Cohere Chat v2 response object");
	}

	if (asString(body.type) === "error" || isRecord(body.error)) {
		const errorBody = isRecord(body.error) ? body.error : body;
		return providerErrorChunksFromPayload(
			errorBody,
			"cohereAdapter.parseResponse",
			false,
			"Cohere provider error",
		);
	}

	const message = isRecord(body.message) ? body.message : undefined;
	if (!message) {
		const chunks: RawChunk[] = [];
		const usage = buildUsageChunk(body.usage, COHERE_USAGE_ALIASES);
		if (usage) chunks.push(usage);
		const finishReason = asString(body.finish_reason);
		if (finishReason) {
			chunks.push({
				kind: "finish",
				reason: mapCohereFinishReason(finishReason),
				choiceIndex: 0,
			});
		} else {
			chunks.push({ kind: "finish", reason: "stop", choiceIndex: 0 });
		}
		return chunks;
	}

	const parser = new CohereStreamParser(options);
	const syntheticEvents = synthesizeCohereStreamEvents(body);
	const chunks: RawChunk[] = [];
	for (const event of syntheticEvents) {
		chunks.push(...parser.parseChunk(JSON.stringify(event)));
	}

	const finishReason = asString(body.finish_reason);
	if (finishReason && !chunks.some((chunk) => chunk.kind === "finish")) {
		chunks.push({
			kind: "finish",
			reason: mapCohereFinishReason(finishReason),
			choiceIndex: 0,
		});
	} else if (!chunks.some((chunk) => chunk.kind === "finish")) {
		chunks.push({ kind: "finish", reason: "stop", choiceIndex: 0 });
	}

	return chunks;
}

export function synthesizeCohereStreamEvents(body: Record<string, unknown>): unknown[] {
	const events: unknown[] = [];
	const message = isRecord(body.message) ? body.message : undefined;
	if (!message) return events;

	const messageId = asString(body.id);
	events.push({
		type: "message-start",
		...(messageId ? { id: messageId } : {}),
		delta: { message: { role: asString(message.role) ?? "assistant" } },
	});

	const toolPlan = asString(message.tool_plan);
	if (toolPlan) {
		events.push({
			type: "tool-plan-delta",
			delta: { message: { tool_plan: toolPlan } },
		});
	}

	const content = Array.isArray(message.content) ? message.content : [];
	for (const block of content) {
		if (!isRecord(block)) continue;
		const text = asString(block.text);
		if (text !== undefined && text.length > 0) {
			events.push({
				type: "content-delta",
				index: 0,
				delta: { message: { content: { text } } },
			});
		}
	}

	const citations = message.citations;
	if (Array.isArray(citations)) {
		for (const citation of citations) {
			events.push({
				type: "citation-start",
				index: 0,
				delta: { message: { citations: citation } },
			});
		}
	}

	const toolCalls = toolCallsFromRecord(message.tool_calls);
	let toolIndex = 0;
	for (const toolCall of toolCalls) {
		const id = asString(toolCall.id) ?? `cohere:tool:${toolIndex}`;
		const fn = isRecord(toolCall.function) ? toolCall.function : undefined;
		const name = fn ? (asString(fn.name) ?? "unknown") : "unknown";
		const args = fn ? asString(fn.arguments) : undefined;
		events.push({
			type: "tool-call-start",
			index: toolIndex,
			delta: {
				message: {
					tool_calls: {
						id,
						type: "function",
						function: { name, arguments: args ?? "" },
					},
				},
			},
		});
		if (args !== undefined && args.length > 0) {
			events.push({
				type: "tool-call-delta",
				index: toolIndex,
				delta: {
					message: {
						tool_calls: {
							id,
							function: { arguments: args },
						},
					},
				},
			});
		}
		events.push({ type: "tool-call-end", index: toolIndex });
		toolIndex += 1;
	}

	if (body.usage !== undefined || body.finish_reason !== undefined) {
		events.push({
			type: "message-end",
			delta: {
				...(body.finish_reason !== undefined ? { finish_reason: body.finish_reason } : {}),
				...(body.usage !== undefined ? { usage: body.usage } : {}),
			},
		});
	}

	return events;
}
