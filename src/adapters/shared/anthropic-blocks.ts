import type { RawChunk } from "../../core/types";
import { asString, isRecord, optionalRawChunk } from "../utils";

export interface AnthropicBlockContext {
	jsonMode?: boolean | undefined;
	mode?: AnthropicBlockMode;
}

export type AnthropicBlockMode = "stream-start" | "response";

/** Map a complete Anthropic content block (response body) to raw chunks. */
export function anthropicResponseBlockChunks(
	block: Record<string, unknown>,
	index: number,
	context: AnthropicBlockContext,
): RawChunk[] {
	return anthropicBlockStartChunks(block, index, { ...context, mode: "response" });
}

/** Map content_block_start envelope block to raw chunks. */
export function anthropicBlockStartChunks(
	block: Record<string, unknown>,
	index: number,
	context: AnthropicBlockContext,
): RawChunk[] {
	const mode = context.mode ?? "stream-start";
	const blockType = asString(block.type) ?? "unknown";
	switch (blockType) {
		case "text": {
			const text = asString(block.text);
			if (!text) return [];
			if (context.jsonMode) return [{ kind: "json-delta", delta: text }];
			return [{ kind: "text-delta", text }];
		}
		case "thinking": {
			const text = asString(block.thinking);
			return text ? [{ kind: "reasoning-delta", text, variant: "detail" }] : [];
		}
		case "redacted_thinking":
			return [];
		case "tool_use":
			return anthropicToolUseBlockChunks(block, index, mode);
		case "json": {
			const text = asString(block.text) ?? asString(block.partial_json);
			return text ? [{ kind: "json-delta", delta: text }] : [];
		}
		case "refusal": {
			const text = asString(block.refusal) ?? asString(block.text);
			return text ? [{ kind: "refusal-delta", text }] : [];
		}
		default:
			return [];
	}
}

function anthropicToolUseBlockChunks(
	block: Record<string, unknown>,
	index: number,
	mode: AnthropicBlockMode,
): RawChunk[] {
	const id = asString(block.id);
	const name = asString(block.name) ?? "unknown";
	const chunks: RawChunk[] = [optionalRawChunk({ kind: "tool-start", id, name, index })];
	const input = block.input;
	if (input !== undefined && !(isRecord(input) && Object.keys(input).length === 0)) {
		chunks.push(
			optionalRawChunk({ kind: "tool-args-delta", id, delta: JSON.stringify(input), index }),
		);
	}
	if (mode === "response") {
		chunks.push(optionalRawChunk({ kind: "tool-done", id, index }));
	}
	return chunks;
}
