import { anthropicAdapter } from "../../src/adapters/anthropic";
import { bedrockAdapter } from "../../src/adapters/bedrock";
import { cohereAdapter } from "../../src/adapters/cohere";
import { geminiAdapter } from "../../src/adapters/gemini";
import { openaiChatAdapter } from "../../src/adapters/openai-chat";
import { openaiCompatibleAdapter } from "../../src/adapters/openai-compatible";
import { openaiResponsesAdapter } from "../../src/adapters/openai-responses";
import type { AssembleOptions, StreamAdapter, StreamEvent } from "../../src/core/types";

export type AdapterFamily =
	| "openai-chat"
	| "openai-compatible"
	| "openai-responses"
	| "anthropic"
	| "gemini"
	| "cohere"
	| "bedrock";

export type AdapterOptionScenario =
	| "json-text"
	| "strict-tool-invalid"
	| "recover-malformed"
	| "legacy-citation";

export interface AdapterOptionsRowSpec {
	id: string;
	adapterFamily: AdapterFamily;
	scenario: AdapterOptionScenario;
	jsonMode: boolean;
	strictToolArgs: boolean;
	recoverMalformed: boolean;
	emitLegacyCitationMetadata: boolean;
}

export interface AdapterOptionsMatrixRow {
	spec: AdapterOptionsRowSpec;
	label: string;
	adapter: StreamAdapter;
	assembleOptions: AssembleOptions;
	payloads: string[];
	hasLegacyMetadata: (events: StreamEvent[]) => boolean;
}

export function buildAdapterOptionsRows(
	specs: readonly AdapterOptionsRowSpec[],
): AdapterOptionsMatrixRow[] {
	return specs.map((spec) => ({
		spec,
		label: rowLabel(spec),
		adapter: adapterForSpec(spec),
		assembleOptions: {
			strictToolArgs: spec.strictToolArgs,
			recoverMalformed: spec.recoverMalformed,
		},
		payloads: payloadsForSpec(spec),
		hasLegacyMetadata: legacyMetadataMatcher(spec.adapterFamily),
	}));
}

function rowLabel(spec: AdapterOptionsRowSpec): string {
	return [
		spec.id,
		spec.adapterFamily,
		spec.scenario,
		`json=${spec.jsonMode}`,
		`strict=${spec.strictToolArgs}`,
		`recover=${spec.recoverMalformed}`,
		`legacy=${spec.emitLegacyCitationMetadata}`,
	].join(" | ");
}

function adapterForSpec(spec: AdapterOptionsRowSpec): StreamAdapter {
	switch (spec.adapterFamily) {
		case "openai-chat":
			return openaiChatAdapter({ jsonMode: spec.jsonMode });
		case "openai-compatible":
			return openaiCompatibleAdapter({
				provider: spec.scenario === "legacy-citation" ? "perplexity" : "generic",
				jsonMode: spec.jsonMode,
				emitLegacyCitationMetadata: spec.emitLegacyCitationMetadata,
			});
		case "openai-responses":
			return openaiResponsesAdapter({ jsonMode: spec.jsonMode });
		case "anthropic":
			return anthropicAdapter({ jsonMode: spec.jsonMode });
		case "gemini":
			return geminiAdapter({
				jsonMode: spec.jsonMode,
				emitLegacyCitationMetadata: spec.emitLegacyCitationMetadata,
			});
		case "cohere":
			return cohereAdapter({
				jsonMode: spec.jsonMode,
				emitLegacyCitationMetadata: spec.emitLegacyCitationMetadata,
			});
		case "bedrock":
			return bedrockAdapter({ jsonMode: spec.jsonMode });
	}
}

function payloadsForSpec(spec: AdapterOptionsRowSpec): string[] {
	switch (spec.scenario) {
		case "json-text":
			return jsonTextPayloads(spec.adapterFamily);
		case "strict-tool-invalid":
			return strictToolInvalidPayloads(spec.adapterFamily);
		case "recover-malformed":
			return recoverMalformedPayloads(spec.adapterFamily);
		case "legacy-citation":
			return legacyCitationPayloads(spec.adapterFamily);
	}
}

function jsonTextPayloads(adapterFamily: AdapterFamily): string[] {
	switch (adapterFamily) {
		case "openai-chat":
		case "openai-compatible":
			return [
				payload({
					id: "cmpl-json",
					object: "chat.completion.chunk",
					choices: [{ index: 0, delta: { content: '{"a":1}' }, finish_reason: null }],
				}),
				payload({
					id: "cmpl-json",
					object: "chat.completion.chunk",
					choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
				}),
			];
		case "openai-responses":
			return [
				payload({ type: "response.output_text.delta", delta: '{"a":1}' }),
				payload({ type: "response.completed", response: {} }),
			];
		case "anthropic":
			return [
				payload({
					type: "content_block_delta",
					index: 0,
					delta: { type: "text_delta", text: '{"a":1}' },
				}),
				payload({ type: "message_delta", delta: { stop_reason: "end_turn" } }),
			];
		case "gemini":
			return [
				payload({
					candidates: [{ index: 0, content: { parts: [{ text: '{"a":1}' }] } }],
				}),
				payload({
					candidates: [{ index: 0, finishReason: "STOP", content: { parts: [] } }],
				}),
			];
		case "cohere":
			return [
				payload({
					type: "message-start",
					id: "m-json",
					delta: { message: { role: "assistant" } },
				}),
				payload({
					type: "content-delta",
					index: 0,
					delta: { message: { content: { text: '{"a":1}' } } },
				}),
				payload({ type: "message-end", delta: { finish_reason: "COMPLETE" } }),
			];
		case "bedrock":
			return [
				payload({ messageStart: { role: "assistant" } }),
				payload({
					contentBlockDelta: { contentBlockIndex: 0, delta: { text: '{"a":1}' } },
				}),
				payload({ messageStop: { stopReason: "end_turn" } }),
			];
	}
}

function strictToolInvalidPayloads(adapterFamily: AdapterFamily): string[] {
	switch (adapterFamily) {
		case "openai-chat":
		case "openai-compatible":
			return [
				payload({
					id: "cmpl-tool",
					object: "chat.completion.chunk",
					choices: [
						{
							index: 0,
							delta: {
								tool_calls: [{ index: 0, id: "call_x", function: { name: "fn", arguments: "{" } }],
							},
							finish_reason: null,
						},
					],
				}),
				payload({
					id: "cmpl-tool",
					object: "chat.completion.chunk",
					choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }],
				}),
			];
		case "openai-responses":
			return [
				payload({
					type: "response.output_item.added",
					output_index: 0,
					item: { type: "function_call", id: "call_x", name: "search", call_id: "call_x" },
				}),
				payload({
					type: "response.function_call_arguments.delta",
					output_index: 0,
					call_id: "call_x",
					delta: "{",
				}),
				payload({ type: "response.completed", response: {} }),
			];
		case "anthropic":
			return [
				payload({
					type: "content_block_start",
					index: 0,
					content_block: { type: "tool_use", id: "toolu_1", name: "get_weather" },
				}),
				payload({
					type: "content_block_delta",
					index: 0,
					delta: { type: "input_json_delta", partial_json: "{" },
				}),
				payload({ type: "message_delta", delta: { stop_reason: "tool_use" } }),
			];
		case "gemini":
			return [
				payload({
					candidates: [
						{
							index: 0,
							content: {
								parts: [{ functionCall: { name: "fn", partialArgs: [{ stringValue: "{" }] } }],
							},
						},
					],
				}),
				payload({
					candidates: [{ index: 0, finishReason: "STOP", content: { parts: [] } }],
				}),
			];
		case "cohere":
			return [
				payload({
					type: "message-start",
					id: "m1",
					delta: { message: { role: "assistant" } },
				}),
				payload({
					type: "tool-call-start",
					index: 0,
					delta: {
						message: {
							tool_calls: {
								type: "function",
								function: { name: "fn", arguments: "" },
							},
						},
					},
				}),
				payload({
					type: "tool-call-delta",
					index: 0,
					delta: {
						message: {
							tool_calls: {
								function: { arguments: "{" },
							},
						},
					},
				}),
				payload({ type: "tool-call-end", index: 0 }),
				payload({ type: "message-end", delta: { finish_reason: "TOOL_CALL" } }),
			];
		case "bedrock":
			return [
				payload({
					contentBlockStart: {
						contentBlockIndex: 0,
						start: { toolUse: { toolUseId: "t1", name: "search" } },
					},
				}),
				payload({
					contentBlockDelta: {
						contentBlockIndex: 0,
						delta: { toolUse: { input: "{" } },
					},
				}),
				payload({ contentBlockStop: { contentBlockIndex: 0 } }),
				payload({ messageStop: { stopReason: "tool_use" } }),
			];
	}
}

function recoverMalformedPayloads(adapterFamily: AdapterFamily): string[] {
	switch (adapterFamily) {
		case "openai-chat":
		case "openai-compatible":
			return [
				payload({
					id: "cmpl-recover",
					object: "chat.completion.chunk",
					choices: [{ index: 0, delta: { content: "ok" }, finish_reason: null }],
				}),
				"{",
				payload({
					id: "cmpl-recover",
					object: "chat.completion.chunk",
					choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
				}),
			];
		case "openai-responses":
			return [
				payload({ type: "response.output_text.delta", delta: "ok" }),
				"{",
				payload({ type: "response.completed", response: {} }),
			];
		case "anthropic":
			return [
				payload({
					type: "content_block_delta",
					index: 0,
					delta: { type: "text_delta", text: "ok" },
				}),
				"{",
				payload({ type: "message_delta", delta: { stop_reason: "end_turn" } }),
			];
		case "gemini":
			return [
				payload({ candidates: [{ index: 0, content: { parts: [{ text: "ok" }] } }] }),
				"{",
				payload({ candidates: [{ index: 0, finishReason: "STOP", content: { parts: [] } }] }),
			];
		case "cohere":
			return [
				payload({
					type: "message-start",
					id: "m-recover",
					delta: { message: { role: "assistant" } },
				}),
				"{",
				payload({ type: "message-end", delta: { finish_reason: "COMPLETE" } }),
			];
		case "bedrock":
			return [
				payload({ messageStart: { role: "assistant" } }),
				"{",
				payload({ messageStop: { stopReason: "end_turn" } }),
			];
	}
}

function legacyCitationPayloads(adapterFamily: AdapterFamily): string[] {
	switch (adapterFamily) {
		case "openai-compatible":
			return [
				payload({
					citations: ["https://legacy.options.test"],
					choices: [{ index: 0, delta: { content: "legacy" }, finish_reason: null }],
				}),
				payload({
					choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
				}),
			];
		case "gemini":
			return [
				payload({
					candidates: [
						{
							index: 0,
							citationMetadata: { citations: [{ uri: "urn:legacy-options" }] },
							groundingMetadata: { webSearchQueries: ["legacy options"] },
							content: { parts: [{ text: "legacy" }] },
						},
					],
				}),
				payload({
					candidates: [{ index: 0, finishReason: "STOP", content: { parts: [] } }],
				}),
			];
		case "cohere":
			return [
				payload({
					type: "citation-start",
					index: 0,
					delta: { message: { citations: { start: 0, end: 6, text: "legacy" } } },
				}),
				payload({ type: "message-end", delta: { finish_reason: "COMPLETE" } }),
			];
		default:
			return jsonTextPayloads(adapterFamily);
	}
}

function legacyMetadataMatcher(adapterFamily: AdapterFamily): (events: StreamEvent[]) => boolean {
	switch (adapterFamily) {
		case "openai-compatible":
			return (events) =>
				events.some(
					(event) =>
						event.type === "metadata" &&
						("citations" in ((event.raw as Record<string, unknown> | undefined) ?? {}) ||
							"search_results" in ((event.raw as Record<string, unknown> | undefined) ?? {})),
				);
		case "gemini":
			return (events) =>
				events.some(
					(event) =>
						event.type === "metadata" &&
						("citationMetadata" in ((event.raw as Record<string, unknown> | undefined) ?? {}) ||
							"groundingMetadata" in ((event.raw as Record<string, unknown> | undefined) ?? {})),
				);
		case "cohere":
			return (events) =>
				events.some(
					(event) =>
						event.type === "metadata" &&
						"citation" in ((event.raw as Record<string, unknown> | undefined) ?? {}),
				);
		default:
			return () => false;
	}
}

function payload(value: unknown): string {
	return JSON.stringify(value);
}
