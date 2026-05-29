import type { RawChunk } from "../../core/types";
import { createLogprobPositionState } from "../common/logprobs";
import { parseAdapterObjectPayload } from "../common/parse-payload";
import { asString, isRecord } from "../utils";
import {
	errorMessage,
	hasResponseMetadata,
	isErrorPayload,
	metadataChunks,
	providerErrorChunks,
	reasoningChunks,
	usageFromResponse,
} from "./common";
import { contentPartChunks } from "./item-events";
import {
	functionArgsDeltaChunks,
	functionArgsDoneChunks,
	outputItemAddedChunks,
	outputItemDeltaChunks,
	outputItemDoneChunks,
} from "./tool-events";
import { refusalDeltaChunks, textDeltaChunks, textDoneChunks } from "./text-events";
import type { OpenAIResponsesAdapterOptions, ResponsesParserContext, ToolState } from "./types";

export class ResponsesParser implements ResponsesParserContext {
	metadataEmitted = false;
	textSeen = false;
	readonly logprobPositions = createLogprobPositionState();
	readonly tools = new Map<string, ToolState>();

	constructor(public readonly options: OpenAIResponsesAdapterOptions) {}

	parseChunk(raw: string): RawChunk[] {
		const payload = parseAdapterObjectPayload(raw, "openaiResponsesAdapter.parseChunk");
		if (!payload) return [];

		if (isErrorPayload(payload)) return providerErrorChunks(errorMessage(payload));

		const chunks: RawChunk[] = [];
		const response = isRecord(payload.response) ? payload.response : payload;
		if (!this.metadataEmitted && isRecord(response) && hasResponseMetadata(response)) {
			chunks.push(...metadataChunks(response));
			this.metadataEmitted = true;
		}

		const type = asString(payload.type);
		switch (type) {
			case "response.created":
			case "response.in_progress":
				break;
			case "response.output_text.delta":
				chunks.push(...textDeltaChunks(this, payload));
				break;
			case "response.output_text.done":
				chunks.push(...textDoneChunks(this, payload));
				break;
			case "response.refusal.delta":
				chunks.push(...refusalDeltaChunks(this, payload));
				break;
			case "response.refusal.done":
				break;
			case "response.content_part.added":
			case "response.content_part.done":
				chunks.push(...contentPartChunks(this, payload));
				break;
			case "response.output_item.added":
				chunks.push(...outputItemAddedChunks(this, payload));
				break;
			case "response.output_item.delta":
				chunks.push(...outputItemDeltaChunks(this, payload));
				break;
			case "response.output_item.done":
				chunks.push(...outputItemDoneChunks(this, payload));
				break;
			case "response.function_call_arguments.delta":
				chunks.push(...functionArgsDeltaChunks(this, payload));
				break;
			case "response.function_call_arguments.done":
				chunks.push(...functionArgsDoneChunks(this, payload));
				break;
			case "response.completed":
				chunks.push(...usageFromResponse(response));
				chunks.push({ kind: "finish", reason: "stop" });
				break;
			case "response.failed":
				chunks.push(...providerErrorChunks(errorMessage(response)));
				break;
			case "response.incomplete":
				chunks.push(...usageFromResponse(response));
				chunks.push({ kind: "finish", reason: "incomplete" });
				break;
			case "error":
				chunks.push(...providerErrorChunks(errorMessage(payload)));
				break;
			default:
				chunks.push(...reasoningChunks(payload));
				break;
		}

		return chunks;
	}
}
