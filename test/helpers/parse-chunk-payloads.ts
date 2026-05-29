export type ParseChunkAdapterName =
	| "openai-chat"
	| "openai-responses"
	| "anthropic"
	| "gemini"
	| "gemini-vertex"
	| "bedrock"
	| "cohere";

export type ParseChunkCategory =
	| "empty"
	| "whitespace"
	| "unknown keys"
	| "partial tools"
	| "finish reasons"
	| "usage-only"
	| "errors"
	| "logprobs"
	| "citations"
	| "multichoice"
	| "message.start"
	| "text"
	| "reasoning"
	| "refusal";

export interface ParseChunkPayloadCase {
	id: string;
	category: ParseChunkCategory;
	note: string;
	payload: string;
	prelude?: string[];
}

interface DraftRow {
	category: ParseChunkCategory;
	note: string;
	payload: string;
	prelude?: string[];
}

export const requiredParseChunkCategories: ParseChunkCategory[] = [
	"empty",
	"whitespace",
	"unknown keys",
	"partial tools",
	"finish reasons",
	"usage-only",
	"errors",
	"logprobs",
	"citations",
	"multichoice",
	"message.start",
];

const sharedGates: Record<ParseChunkAdapterName, ParseChunkPayloadCase[]> = {
	"openai-chat": [
		{ id: "PC01", category: "empty", note: "empty payload", payload: "" },
		{ id: "PC02", category: "whitespace", note: "whitespace payload", payload: " \n\t " },
		{
			id: "PC03",
			category: "message.start",
			note: "role-only message start",
			payload:
				'{"id":"pc03","created":1,"model":"gpt-4o-mini","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}',
		},
		{
			id: "PC04",
			category: "usage-only",
			note: "usage-only chunk",
			payload: '{"usage":{"prompt_tokens":1,"completion_tokens":2}}',
		},
		{
			id: "PC05",
			category: "unknown keys",
			note: "unknown key tolerated",
			payload: '{"id":"pc05","choices":[],"mystery":{"alpha":1}}',
		},
	],
	"openai-responses": [
		{ id: "PC01", category: "empty", note: "empty payload", payload: "" },
		{ id: "PC02", category: "whitespace", note: "whitespace payload", payload: "  \n\t " },
		{
			id: "PC03",
			category: "message.start",
			note: "response.created start metadata",
			payload:
				'{"type":"response.created","response":{"id":"pc03","model":"gpt-4.1-mini","created_at":1}}',
		},
		{
			id: "PC04",
			category: "usage-only",
			note: "completed usage-only",
			payload:
				'{"type":"response.completed","response":{"usage":{"input_tokens":1,"output_tokens":2}}}',
		},
		{
			id: "PC05",
			category: "unknown keys",
			note: "known event with unknown keys",
			payload: '{"type":"response.in_progress","response":{"id":"pc05"},"mystery":{"beta":2}}',
		},
	],
	anthropic: [
		{ id: "PC01", category: "empty", note: "empty payload", payload: "" },
		{ id: "PC02", category: "whitespace", note: "whitespace payload", payload: " \n " },
		{
			id: "PC03",
			category: "message.start",
			note: "message_start baseline",
			payload: '{"type":"message_start","message":{"id":"pc03","model":"claude-3-5-sonnet"}}',
		},
		{
			id: "PC04",
			category: "usage-only",
			note: "message_delta usage only",
			payload: '{"type":"message_delta","delta":{},"usage":{"output_tokens":1}}',
		},
		{
			id: "PC05",
			category: "unknown keys",
			note: "message_start unknown key",
			payload:
				'{"type":"message_start","message":{"id":"pc05","model":"claude-3-haiku"},"mystery":{"gamma":3}}',
		},
	],
	gemini: [
		{ id: "PC01", category: "empty", note: "empty payload", payload: "" },
		{ id: "PC02", category: "whitespace", note: "whitespace payload", payload: " \t " },
		{
			id: "PC03",
			category: "message.start",
			note: "responseId + modelVersion",
			payload: '{"responseId":"pc03","modelVersion":"gemini-2.5-flash","candidates":[]}',
		},
		{
			id: "PC04",
			category: "usage-only",
			note: "usageMetadata only",
			payload: '{"usageMetadata":{"promptTokenCount":1,"candidatesTokenCount":2}}',
		},
		{
			id: "PC05",
			category: "unknown keys",
			note: "unknown key alongside metadata",
			payload: '{"responseId":"pc05","candidates":[],"mystery":{"delta":4}}',
		},
	],
	"gemini-vertex": [
		{ id: "PC01", category: "empty", note: "empty payload", payload: "" },
		{ id: "PC02", category: "whitespace", note: "whitespace payload", payload: " \n\t  " },
		{
			id: "PC03",
			category: "message.start",
			note: "vertex wrapped message start",
			payload:
				'{"response":{"responseId":"pc03","modelVersion":"gemini-2.5-flash","candidates":[]}}',
		},
		{
			id: "PC04",
			category: "usage-only",
			note: "vertex wrapped usage",
			payload: '{"response":{"usageMetadata":{"promptTokenCount":1,"candidatesTokenCount":2}}}',
		},
		{
			id: "PC05",
			category: "unknown keys",
			note: "vertex unknown key in response wrapper",
			payload: '{"response":{"responseId":"pc05","candidates":[],"mystery":{"epsilon":5}}}',
		},
	],
	bedrock: [
		{ id: "PC01", category: "empty", note: "empty payload", payload: "" },
		{ id: "PC02", category: "whitespace", note: "whitespace payload", payload: " \n\t " },
		{
			id: "PC03",
			category: "message.start",
			note: "messageStart baseline",
			payload: '{"messageStart":{"role":"assistant"}}',
		},
		{
			id: "PC04",
			category: "usage-only",
			note: "metadata usage-only",
			payload: '{"metadata":{"usage":{"inputTokens":1,"outputTokens":2}}}',
		},
		{
			id: "PC05",
			category: "unknown keys",
			note: "unknown envelope metadata fallback",
			payload: '{"mystery":{"zeta":6}}',
		},
	],
	cohere: [
		{ id: "PC01", category: "empty", note: "empty payload", payload: "" },
		{ id: "PC02", category: "whitespace", note: "whitespace payload", payload: " \n\t " },
		{
			id: "PC03",
			category: "message.start",
			note: "message-start baseline",
			payload: '{"type":"message-start","id":"pc03","delta":{"message":{"role":"assistant"}}}',
		},
		{
			id: "PC04",
			category: "usage-only",
			note: "message-end usage-only",
			payload:
				'{"type":"message-end","delta":{"usage":{"billed_units":{"input_tokens":1,"output_tokens":2}}}}',
		},
		{
			id: "PC05",
			category: "unknown keys",
			note: "content-delta unknown key",
			payload:
				'{"type":"content-delta","index":0,"delta":{"message":{"content":{"text":"pc05"}}},"mystery":{"eta":7}}',
		},
	],
};

const openAIChatRows = buildRows("OC", 451, [
	{
		category: "text",
		note: "simple content delta",
		payload: '{"choices":[{"index":0,"delta":{"content":"hello"}}]}',
	},
	{
		category: "text",
		note: "unicode content delta",
		payload: '{"choices":[{"index":0,"delta":{"content":"Ahoj 😀"}}]}',
	},
	{
		category: "refusal",
		note: "refusal delta",
		payload: '{"choices":[{"index":0,"delta":{"refusal":"cannot comply"}}]}',
	},
	{
		category: "reasoning",
		note: "reasoning field",
		payload: '{"choices":[{"index":0,"delta":{"reasoning":"inspect plan"}}]}',
	},
	{
		category: "reasoning",
		note: "reasoning summary alias",
		payload: '{"choices":[{"index":0,"delta":{"reasoning_summary":"short summary"}}]}',
	},
	{
		category: "partial tools",
		note: "tool start no args",
		payload:
			'{"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"oc_tool_1","function":{"name":"search"}}]}}]}',
	},
	{
		category: "partial tools",
		note: "tool args delta",
		payload:
			'{"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"oc_tool_2","function":{"name":"search","arguments":"{\\"q\\":\\"hi"}}]}}]}',
	},
	{
		category: "partial tools",
		note: "tool args without explicit id",
		payload:
			'{"choices":[{"index":0,"delta":{"tool_calls":[{"index":1,"function":{"name":"lookup","arguments":"{\\"topic\\":\\"llm\\"}"}}]}}]}',
	},
	{
		category: "partial tools",
		note: "legacy function start",
		payload: '{"choices":[{"index":0,"delta":{"function_call":{"name":"legacy_fn"}}}]}',
	},
	{
		category: "partial tools",
		note: "legacy function args",
		payload:
			'{"choices":[{"index":0,"delta":{"function_call":{"arguments":"{\\"legacy\\":true}"}}}]}',
	},
	{
		category: "finish reasons",
		note: "finish stop",
		payload: '{"choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}',
	},
	{
		category: "finish reasons",
		note: "finish length",
		payload: '{"choices":[{"index":0,"delta":{},"finish_reason":"length"}]}',
	},
	{
		category: "finish reasons",
		note: "finish content filter",
		payload: '{"choices":[{"index":0,"delta":{},"finish_reason":"content_filter"}]}',
	},
	{
		category: "finish reasons",
		note: "finish tool calls",
		payload: '{"choices":[{"index":0,"delta":{},"finish_reason":"tool_calls"}]}',
	},
	{
		category: "finish reasons",
		note: "finish function_call alias",
		payload: '{"choices":[{"index":0,"delta":{},"finish_reason":"function_call"}]}',
	},
	{
		category: "finish reasons",
		note: "finish unknown reason maps provider error",
		payload: '{"choices":[{"index":0,"delta":{},"finish_reason":"odd_reason"}]}',
	},
	{
		category: "usage-only",
		note: "usage input output",
		payload: '{"usage":{"prompt_tokens":9,"completion_tokens":3}}',
	},
	{
		category: "usage-only",
		note: "usage with reasoning tokens",
		payload:
			'{"usage":{"prompt_tokens":4,"completion_tokens":8,"completion_tokens_details":{"reasoning_tokens":2}}}',
	},
	{
		category: "errors",
		note: "provider error object",
		payload: '{"error":{"message":"rate limit","type":"rate_limit_error"}}',
	},
	{
		category: "errors",
		note: "string error ignored in strict shape",
		payload: '{"error":"temporary issue","choices":[]}',
	},
	{
		category: "logprobs",
		note: "content logprobs single token",
		payload:
			'{"choices":[{"index":0,"delta":{},"logprobs":{"content":[{"token":"Hi","logprob":-0.1}]}}]}',
	},
	{
		category: "logprobs",
		note: "refusal logprobs single token",
		payload:
			'{"choices":[{"index":0,"delta":{"refusal":"no"},"logprobs":{"refusal":[{"token":"No","logprob":-1.1}]}}]}',
	},
	{
		category: "logprobs",
		note: "content logprobs with top alternatives",
		payload:
			'{"choices":[{"index":0,"delta":{},"logprobs":{"content":[{"token":"x","logprob":-0.3,"top_logprobs":[{"token":"x","logprob":-0.3},{"token":"y","logprob":-1.2}]}]}}]}',
	},
	{
		category: "citations",
		note: "citations urls",
		payload: '{"choices":[],"citations":["https://a.test","https://b.test"]}',
	},
	{
		category: "citations",
		note: "search_results citations",
		payload: '{"choices":[],"search_results":[{"title":"Doc","url":"https://docs.test"}]}',
	},
	{
		category: "citations",
		note: "citations and search_results",
		payload:
			'{"choices":[],"citations":["https://c.test"],"search_results":[{"title":"R1"},{"title":"R2"}]}',
	},
	{
		category: "multichoice",
		note: "two choices content",
		payload:
			'{"choices":[{"index":0,"delta":{"content":"left"}},{"index":1,"delta":{"content":"right"}}]}',
	},
	{
		category: "multichoice",
		note: "two choices finish reasons",
		payload:
			'{"choices":[{"index":0,"delta":{},"finish_reason":"stop"},{"index":1,"delta":{},"finish_reason":"length"}]}',
	},
	{
		category: "multichoice",
		note: "two choices tool call starts",
		payload:
			'{"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"oc_m1","function":{"name":"a","arguments":"{}"}}]}},{"index":1,"delta":{"tool_calls":[{"index":0,"id":"oc_m2","function":{"name":"b","arguments":"{}"}}]}}]}',
	},
	{
		category: "unknown keys",
		note: "unknown root keys with recognizable object",
		payload: '{"object":"chat.completion.chunk","mystery":["x","y"],"choices":[]}',
	},
	{
		category: "unknown keys",
		note: "unknown choice delta fields",
		payload: '{"choices":[{"index":0,"delta":{"content":"known","extra_delta":"value"}}]}',
	},
	{
		category: "message.start",
		note: "metadata-only start chunk",
		payload: '{"id":"oc_meta_1","model":"gpt-4o","created":10,"choices":[]}',
	},
	{
		category: "message.start",
		note: "object-only with choices",
		payload: '{"object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"x"}}]}',
	},
	{
		category: "usage-only",
		note: "usage output only",
		payload: '{"usage":{"completion_tokens":11}}',
	},
	{
		category: "text",
		note: "multiline content",
		payload: '{"choices":[{"index":0,"delta":{"content":"line1\\nline2"}}]}',
	},
]);

const openAIResponsesRows = buildRows("R", 100, [
	{
		category: "message.start",
		note: "response.in_progress emits metadata once",
		payload:
			'{"type":"response.in_progress","response":{"id":"r100","model":"gpt-4.1","created_at":2}}',
	},
	{
		category: "text",
		note: "output_text delta basic",
		payload: '{"type":"response.output_text.delta","delta":"hello"}',
	},
	{
		category: "text",
		note: "output_text delta unicode",
		payload: '{"type":"response.output_text.delta","delta":"🚀 launch"}',
	},
	{
		category: "text",
		note: "output_text done fallback",
		payload: '{"type":"response.output_text.done","text":"done text"}',
	},
	{
		category: "refusal",
		note: "refusal delta event",
		payload: '{"type":"response.refusal.delta","delta":"cannot"}',
	},
	{
		category: "reasoning",
		note: "reasoning summary field",
		payload: '{"type":"response.reasoning","summary":"chain summary"}',
	},
	{
		category: "text",
		note: "content_part added output_text",
		payload:
			'{"type":"response.content_part.added","part":{"type":"output_text","text":"part-add"}}',
	},
	{
		category: "text",
		note: "content_part done output_text",
		payload:
			'{"type":"response.content_part.done","part":{"type":"output_text","text":"part-done"}}',
	},
	{
		category: "partial tools",
		note: "output_item added function call with args",
		payload:
			'{"type":"response.output_item.added","output_index":0,"item":{"type":"function_call","id":"item_1","call_id":"call_1","name":"search","arguments":"{\\"q\\":\\"hi\\"}"}}',
	},
	{
		category: "partial tools",
		note: "output_item delta arguments",
		payload:
			'{"type":"response.output_item.delta","output_index":0,"item_id":"item_1","delta":{"name":"search","arguments":"{\\"q\\":\\"partial"}}',
	},
	{
		category: "partial tools",
		note: "output_item done function call",
		payload:
			'{"type":"response.output_item.done","output_index":0,"item":{"type":"function_call","id":"item_1","call_id":"call_1","name":"search","arguments":"{\\"q\\":\\"done\\"}"}}',
	},
	{
		category: "partial tools",
		note: "function_call_arguments delta",
		payload:
			'{"type":"response.function_call_arguments.delta","output_index":0,"call_id":"call_2","name":"lookup","delta":"{\\"city\\":\\"Bratis"}',
	},
	{
		category: "partial tools",
		note: "function_call_arguments done",
		payload:
			'{"type":"response.function_call_arguments.done","output_index":0,"call_id":"call_2","name":"lookup","arguments":"{\\"city\\":\\"Bratislava\\"}"}',
	},
	{
		category: "finish reasons",
		note: "response completed",
		payload:
			'{"type":"response.completed","response":{"usage":{"input_tokens":5,"output_tokens":7}}}',
	},
	{
		category: "finish reasons",
		note: "response incomplete",
		payload:
			'{"type":"response.incomplete","response":{"usage":{"input_tokens":3,"output_tokens":1}}}',
	},
	{
		category: "errors",
		note: "response failed",
		payload: '{"type":"response.failed","response":{"error":{"message":"backend failure"}}}',
	},
	{
		category: "errors",
		note: "typed error payload",
		payload: '{"type":"error","error":{"message":"stream terminated"}}',
	},
	{
		category: "usage-only",
		note: "usage-only completed",
		payload:
			'{"type":"response.completed","response":{"usage":{"input_tokens":1,"output_tokens":0}}}',
	},
	{
		category: "logprobs",
		note: "output_text delta with logprobs",
		payload:
			'{"type":"response.output_text.delta","delta":"A","logprobs":[{"token":"A","logprob":-0.2}]}',
	},
	{
		category: "logprobs",
		note: "refusal delta with logprobs",
		payload:
			'{"type":"response.refusal.delta","delta":"N","logprobs":[{"token":"N","logprob":-1.3}]}',
	},
	{
		category: "logprobs",
		note: "content part logprobs",
		payload:
			'{"type":"response.content_part.added","output_index":1,"part":{"type":"output_text","text":"B","logprobs":[{"token":"B","logprob":-0.4}]}}',
	},
	{
		category: "citations",
		note: "output_text delta with citation-like extras",
		payload:
			'{"type":"response.output_text.delta","delta":"cited","citations":[{"url":"https://responses.test"}]}',
	},
	{
		category: "multichoice",
		note: "output index one text",
		payload: '{"type":"response.output_text.delta","output_index":1,"delta":"choice-1"}',
	},
	{
		category: "multichoice",
		note: "output index two refusal",
		payload: '{"type":"response.refusal.delta","output_index":2,"delta":"choice-2-refuse"}',
	},
	{
		category: "message.start",
		note: "response.created top-level response metadata",
		payload:
			'{"type":"response.created","response":{"id":"r124","model":"gpt-4.1-mini","created_at":24}}',
	},
	{
		category: "unknown keys",
		note: "known event with unknown blob",
		payload: '{"type":"response.output_text.delta","delta":"known","mystery":{"k":"v"}}',
	},
	{
		category: "text",
		note: "output item added output_text content",
		payload:
			'{"type":"response.output_item.added","output_index":0,"item":{"type":"message","content":[{"type":"output_text","text":"item-text"}]}}',
	},
	{
		category: "reasoning",
		note: "output item done with reasoning",
		payload:
			'{"type":"response.output_item.done","output_index":0,"item":{"type":"message","reasoning":"trace this"}}',
	},
	{
		category: "text",
		note: "json-like delta string",
		payload: '{"type":"response.output_text.delta","delta":"{\\"ok\\":"}',
	},
	{
		category: "whitespace",
		note: "output_text empty delta",
		payload: '{"type":"response.output_text.delta","delta":""}',
	},
	{
		category: "unknown keys",
		note: "output_item.delta without args",
		payload: '{"type":"response.output_item.delta","output_index":0,"delta":{"noop":true}}',
	},
	{
		category: "partial tools",
		note: "args delta without prior state",
		payload:
			'{"type":"response.function_call_arguments.delta","output_index":3,"name":"fallback","delta":"{\\"z\\":1}"}',
	},
	{
		category: "partial tools",
		note: "args done without prior state",
		payload:
			'{"type":"response.function_call_arguments.done","output_index":3,"name":"fallback","arguments":"{\\"z\\":2}"}',
	},
	{
		category: "message.start",
		note: "response.created id only",
		payload: '{"type":"response.created","response":{"id":"r132"}}',
	},
	{
		category: "message.start",
		note: "response.in_progress id only",
		payload: '{"type":"response.in_progress","response":{"id":"r133"}}',
	},
	{
		category: "finish reasons",
		note: "completed no usage still finishes",
		payload: '{"type":"response.completed","response":{"status":"completed"}}',
	},
	{
		category: "errors",
		note: "failed with string message",
		payload: '{"type":"response.failed","response":{"message":"just failed"}}',
	},
]);

const anthropicRows = buildRows("A", 86, [
	{
		category: "text",
		note: "content_block_start text",
		payload:
			'{"type":"content_block_start","index":0,"content_block":{"type":"text","text":"hello"}}',
	},
	{
		category: "text",
		note: "content_block_delta text after start",
		payload:
			'{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" there"}}',
		prelude: ['{"type":"content_block_start","index":0,"content_block":{"type":"text"}}'],
	},
	{
		category: "reasoning",
		note: "content_block_start thinking",
		payload:
			'{"type":"content_block_start","index":1,"content_block":{"type":"thinking","thinking":"analyze"}}',
	},
	{
		category: "reasoning",
		note: "thinking_delta maps reasoning",
		payload:
			'{"type":"content_block_delta","index":1,"delta":{"type":"thinking_delta","thinking":"step2"}}',
	},
	{
		category: "partial tools",
		note: "tool_use start",
		payload:
			'{"type":"content_block_start","index":2,"content_block":{"type":"tool_use","id":"a_tool_1","name":"search","input":{}}}',
	},
	{
		category: "partial tools",
		note: "input_json_delta for open tool",
		payload:
			'{"type":"content_block_delta","index":2,"delta":{"type":"input_json_delta","partial_json":"{\\"q\\":\\"anth"}}',
		prelude: [
			'{"type":"content_block_start","index":2,"content_block":{"type":"tool_use","id":"a_tool_2","name":"search","input":{}}}',
		],
	},
	{
		category: "partial tools",
		note: "content_block_stop closes tool",
		payload: '{"type":"content_block_stop","index":2}',
		prelude: [
			'{"type":"content_block_start","index":2,"content_block":{"type":"tool_use","id":"a_tool_3","name":"search","input":{}}}',
		],
	},
	{
		category: "finish reasons",
		note: "message_delta end_turn",
		payload:
			'{"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":1}}',
	},
	{
		category: "finish reasons",
		note: "message_delta max_tokens",
		payload:
			'{"type":"message_delta","delta":{"stop_reason":"max_tokens"},"usage":{"output_tokens":2}}',
	},
	{
		category: "finish reasons",
		note: "message_delta tool_use",
		payload:
			'{"type":"message_delta","delta":{"stop_reason":"tool_use"},"usage":{"output_tokens":3}}',
	},
	{
		category: "finish reasons",
		note: "message_stop fallback finish",
		payload: '{"type":"message_stop"}',
	},
	{
		category: "usage-only",
		note: "message_delta usage-only no stop",
		payload: '{"type":"message_delta","delta":{},"usage":{"output_tokens":9}}',
	},
	{
		category: "errors",
		note: "error payload overloaded",
		payload: '{"type":"error","error":{"type":"overloaded_error","message":"busy"}}',
	},
	{
		category: "unknown keys",
		note: "ping ignored",
		payload: '{"type":"ping"}',
	},
	{
		category: "unknown keys",
		note: "signature_delta ignored",
		payload: '{"type":"content_block_delta","index":0,"delta":{"type":"signature_delta"}}',
	},
	{
		category: "message.start",
		note: "message_start with usage",
		payload:
			'{"type":"message_start","message":{"id":"a_start_1","model":"claude-3-5-sonnet","usage":{"input_tokens":4,"output_tokens":0}}}',
	},
	{
		category: "message.start",
		note: "message_start no usage",
		payload: '{"type":"message_start","message":{"id":"a_start_2","model":"claude-3-haiku"}}',
	},
	{
		category: "refusal",
		note: "refusal block start",
		payload:
			'{"type":"content_block_start","index":4,"content_block":{"type":"refusal","refusal":"policy block"}}',
	},
	{
		category: "refusal",
		note: "refusal text delta while refusal block open",
		payload:
			'{"type":"content_block_delta","index":4,"delta":{"type":"text_delta","text":"still no"}}',
		prelude: ['{"type":"content_block_start","index":4,"content_block":{"type":"refusal"}}'],
	},
	{
		category: "partial tools",
		note: "json block start emits json-delta",
		payload:
			'{"type":"content_block_start","index":5,"content_block":{"type":"json","text":"{\\"a\\":"}}',
	},
	{
		category: "partial tools",
		note: "json block text delta treated as json-delta",
		payload: '{"type":"content_block_delta","index":5,"delta":{"type":"text_delta","text":"1}"}}',
		prelude: ['{"type":"content_block_start","index":5,"content_block":{"type":"json"}}'],
	},
	{
		category: "reasoning",
		note: "redacted thinking is ignored",
		payload:
			'{"type":"content_block_start","index":6,"content_block":{"type":"redacted_thinking"}}',
	},
	{
		category: "partial tools",
		note: "tool_use start with prefilled input",
		payload:
			'{"type":"content_block_start","index":7,"content_block":{"type":"tool_use","id":"a_tool_7","name":"lookup","input":{"city":"Bratislava"}}}',
	},
	{
		category: "partial tools",
		note: "input_json_delta empty ignored",
		payload:
			'{"type":"content_block_delta","index":7,"delta":{"type":"input_json_delta","partial_json":""}}',
		prelude: [
			'{"type":"content_block_start","index":7,"content_block":{"type":"tool_use","id":"a_tool_8","name":"lookup","input":{}}}',
		],
	},
	{
		category: "whitespace",
		note: "text_delta empty ignored",
		payload: '{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":""}}',
		prelude: ['{"type":"content_block_start","index":0,"content_block":{"type":"text"}}'],
	},
	{
		category: "unknown keys",
		note: "content_block_stop non-tool",
		payload: '{"type":"content_block_stop","index":0}',
		prelude: ['{"type":"content_block_start","index":0,"content_block":{"type":"text"}}'],
	},
	{
		category: "unknown keys",
		note: "message_delta unknown fields",
		payload: '{"type":"message_delta","delta":{"unknown":"x"},"usage":{"output_tokens":1}}',
	},
	{
		category: "unknown keys",
		note: "message_start with mystery key",
		payload:
			'{"type":"message_start","message":{"id":"a_unknown","model":"claude-3-5-sonnet"},"mystery":{"k":1}}',
	},
	{
		category: "citations",
		note: "text block carries citation-like extras",
		payload:
			'{"type":"content_block_start","index":8,"content_block":{"type":"text","text":"cited","citations":[{"url":"https://a.test"}]}}',
	},
	{
		category: "logprobs",
		note: "text delta carries logprob-like extras",
		payload:
			'{"type":"content_block_delta","index":8,"delta":{"type":"text_delta","text":"lp","logprobs":[{"token":"lp","logprob":-0.2}]}}',
		prelude: ['{"type":"content_block_start","index":8,"content_block":{"type":"text"}}'],
	},
	{
		category: "finish reasons",
		note: "content_filtered reason maps content_filter",
		payload:
			'{"type":"message_delta","delta":{"stop_reason":"content_filtered"},"usage":{"output_tokens":4}}',
	},
	{
		category: "finish reasons",
		note: "unknown stop reason defaults stop",
		payload:
			'{"type":"message_delta","delta":{"stop_reason":"something_else"},"usage":{"output_tokens":5}}',
	},
	{
		category: "multichoice",
		note: "text event on non-zero index",
		payload:
			'{"type":"content_block_start","index":11,"content_block":{"type":"text","text":"choice-11"}}',
	},
	{
		category: "multichoice",
		note: "tool event on non-zero index",
		payload:
			'{"type":"content_block_start","index":12,"content_block":{"type":"tool_use","id":"a_tool_12","name":"multi","input":{}}}',
	},
	{
		category: "errors",
		note: "error payload with only message",
		payload: '{"type":"error","error":{"message":"anthropic generic"}}',
	},
	{
		category: "text",
		note: "text block multiline",
		payload:
			'{"type":"content_block_start","index":13,"content_block":{"type":"text","text":"l1\\nl2"}}',
	},
]);

const geminiRows = buildRows("G", 119, [
	{
		category: "text",
		note: "text part basic",
		payload: '{"candidates":[{"index":0,"content":{"parts":[{"text":"hello"}]}}]}',
	},
	{
		category: "text",
		note: "text part unicode",
		payload: '{"candidates":[{"index":0,"content":{"parts":[{"text":"你好 🌍"}]}}]}',
	},
	{
		category: "whitespace",
		note: "empty text ignored",
		payload: '{"candidates":[{"index":0,"content":{"parts":[{"text":""}]}}]}',
	},
	{
		category: "reasoning",
		note: "thought text to reasoning delta",
		payload: '{"candidates":[{"index":0,"content":{"parts":[{"thought":true,"text":"think"}]}}]}',
	},
	{
		category: "reasoning",
		note: "thought without text ignored",
		payload: '{"candidates":[{"index":0,"content":{"parts":[{"thought":true}]}}]}',
	},
	{
		category: "partial tools",
		note: "function call args object immediate done",
		payload:
			'{"candidates":[{"index":0,"content":{"parts":[{"functionCall":{"id":"g_tool_1","name":"search","args":{"q":"hi"}}}]}}]}',
	},
	{
		category: "partial tools",
		note: "function call partial args continue",
		payload:
			'{"candidates":[{"index":0,"content":{"parts":[{"functionCall":{"id":"g_tool_2","name":"lookup","partialArgs":[{"stringValue":"{\\"city\\":\\"Bra","willContinue":true}],"willContinue":true}}]}}]}',
	},
	{
		category: "partial tools",
		note: "function call continuation and close",
		payload:
			'{"candidates":[{"index":0,"content":{"parts":[{"functionCall":{"id":"g_tool_2","partialArgs":[{"stringValue":"tislava\\"}"}]}}]}}]}',
		prelude: [
			'{"candidates":[{"index":0,"content":{"parts":[{"functionCall":{"id":"g_tool_2","name":"lookup","partialArgs":[{"stringValue":"{\\"city\\":\\"Bra","willContinue":true}],"willContinue":true}}]}}]}',
		],
	},
	{
		category: "finish reasons",
		note: "finish STOP",
		payload:
			'{"candidates":[{"index":0,"finishReason":"STOP","content":{"parts":[{"text":"done"}]}}]}',
	},
	{
		category: "finish reasons",
		note: "finish MAX_TOKENS",
		payload:
			'{"candidates":[{"index":0,"finishReason":"MAX_TOKENS","content":{"parts":[{"text":"done"}]}}]}',
	},
	{
		category: "finish reasons",
		note: "finish SAFETY",
		payload:
			'{"candidates":[{"index":0,"finishReason":"SAFETY","content":{"parts":[{"text":"filtered"}]}}]}',
	},
	{
		category: "finish reasons",
		note: "finish MALFORMED_FUNCTION_CALL",
		payload:
			'{"candidates":[{"index":0,"finishReason":"MALFORMED_FUNCTION_CALL","content":{"parts":[{"text":"err"}]}}]}',
	},
	{
		category: "usage-only",
		note: "usage metadata only",
		payload: '{"usageMetadata":{"promptTokenCount":7,"candidatesTokenCount":9}}',
	},
	{
		category: "usage-only",
		note: "usage total only",
		payload: '{"usageMetadata":{"totalTokenCount":15}}',
	},
	{
		category: "message.start",
		note: "response metadata with candidates",
		payload:
			'{"responseId":"g_meta_1","modelVersion":"gemini-2.5-pro","candidates":[{"index":0,"content":{"parts":[{"text":"meta"}]}}]}',
	},
	{
		category: "message.start",
		note: "response id only",
		payload: '{"responseId":"g_meta_2","candidates":[]}',
	},
	{
		category: "errors",
		note: "prompt feedback block",
		payload: '{"promptFeedback":{"blockReason":"SAFETY"}}',
	},
	{
		category: "errors",
		note: "error payload",
		payload: '{"error":{"message":"quota exceeded","code":429}}',
	},
	{
		category: "citations",
		note: "citation metadata from candidate",
		payload:
			'{"candidates":[{"index":0,"citationMetadata":{"citations":[{"startIndex":0,"endIndex":4}]},"content":{"parts":[{"text":"cite"}]}}]}',
	},
	{
		category: "citations",
		note: "grounding metadata from candidate",
		payload:
			'{"candidates":[{"index":0,"groundingMetadata":{"webSearchQueries":["llm"],"groundingChunks":[{"chunk":"a"}],"groundingSupports":[{"support":"b"}]},"content":{"parts":[{"text":"ground"}]}}]}',
	},
	{
		category: "citations",
		note: "citation and grounding combined",
		payload:
			'{"candidates":[{"index":0,"citationMetadata":{"citations":[{"id":"c1"}]},"groundingMetadata":{"webSearchQueries":["q1"]},"content":{"parts":[{"text":"both"}]}}]}',
	},
	{
		category: "multichoice",
		note: "two candidate text deltas",
		payload:
			'{"candidates":[{"index":0,"content":{"parts":[{"text":"left"}]}},{"index":1,"content":{"parts":[{"text":"right"}]}}]}',
	},
	{
		category: "multichoice",
		note: "two candidate finish reasons",
		payload:
			'{"candidates":[{"index":0,"finishReason":"STOP","content":{"parts":[{"text":"a"}]}},{"index":2,"finishReason":"MAX_TOKENS","content":{"parts":[{"text":"b"}]}}]}',
	},
	{
		category: "unknown keys",
		note: "unknown part shape ignored",
		payload: '{"candidates":[{"index":0,"content":{"parts":[{"customField":"x"}]}}]}',
	},
	{
		category: "unknown keys",
		note: "inlineData ignored",
		payload:
			'{"candidates":[{"index":0,"content":{"parts":[{"inlineData":{"mimeType":"image/png","data":"AA=="}}]}}]}',
	},
	{
		category: "unknown keys",
		note: "fileData ignored",
		payload:
			'{"candidates":[{"index":0,"content":{"parts":[{"fileData":{"mimeType":"text/plain","fileUri":"gs://f"}}]}}]}',
	},
	{
		category: "unknown keys",
		note: "functionResponse ignored",
		payload:
			'{"candidates":[{"index":0,"content":{"parts":[{"functionResponse":{"name":"fn","response":{"ok":true}}}]}}]}',
	},
	{
		category: "unknown keys",
		note: "executableCode ignored",
		payload:
			'{"candidates":[{"index":0,"content":{"parts":[{"executableCode":{"language":"python","code":"print(1)"}}]}}]}',
	},
	{
		category: "logprobs",
		note: "unknown logprob-like field tolerated",
		payload:
			'{"candidates":[{"index":0,"logprobsResult":{"tokens":[{"token":"x","logprob":-0.4}]},"content":{"parts":[{"text":"lp"}]}}]}',
	},
	{
		category: "citations",
		note: "citation on non-zero choice",
		payload:
			'{"candidates":[{"index":3,"citationMetadata":{"citations":[{"id":"cx"}]},"content":{"parts":[{"text":"idx3"}]}}]}',
	},
	{
		category: "partial tools",
		note: "partial arg number value",
		payload:
			'{"candidates":[{"index":0,"content":{"parts":[{"functionCall":{"id":"g_tool_num","name":"set","partialArgs":[{"jsonPath":"$.n","numberValue":4}]}}]}}]}',
	},
	{
		category: "partial tools",
		note: "partial arg bool value",
		payload:
			'{"candidates":[{"index":0,"content":{"parts":[{"functionCall":{"id":"g_tool_bool","name":"set","partialArgs":[{"jsonPath":"$.ok","boolValue":true}]}}]}}]}',
	},
	{
		category: "partial tools",
		note: "partial arg null value",
		payload:
			'{"candidates":[{"index":0,"content":{"parts":[{"functionCall":{"id":"g_tool_null","name":"set","partialArgs":[{"jsonPath":"$.x","nullValue":0}]}}]}}]}',
	},
	{
		category: "usage-only",
		note: "usage and candidate text same chunk",
		payload:
			'{"usageMetadata":{"promptTokenCount":2,"candidatesTokenCount":1},"candidates":[{"index":0,"content":{"parts":[{"text":"combo"}]}}]}',
	},
	{
		category: "text",
		note: "multiline text",
		payload: '{"candidates":[{"index":0,"content":{"parts":[{"text":"l1\\nl2"}]}}]}',
	},
]);

const geminiVertexRows = buildRows("GV", 137, [
	{
		category: "text",
		note: "response wrapper text",
		payload:
			'{"response":{"candidates":[{"index":0,"content":{"parts":[{"text":"vertex-response"}]}}]}}',
	},
	{
		category: "text",
		note: "result wrapper text",
		payload:
			'{"result":{"candidates":[{"index":0,"content":{"parts":[{"text":"vertex-result"}]}}]}}',
	},
	{
		category: "text",
		note: "predictions wrapper text",
		payload:
			'{"predictions":[{"candidates":[{"index":0,"content":{"parts":[{"text":"vertex-pred"}]}}]}]}',
	},
	{
		category: "usage-only",
		note: "response wrapper usage-only",
		payload: '{"response":{"usageMetadata":{"promptTokenCount":3,"candidatesTokenCount":4}}}',
	},
	{
		category: "message.start",
		note: "response wrapper metadata",
		payload:
			'{"response":{"responseId":"gv_meta_1","modelVersion":"gemini-2.5-flash","candidates":[]}}',
	},
	{
		category: "finish reasons",
		note: "vertex STOP finish reason",
		payload:
			'{"response":{"candidates":[{"index":0,"finishReason":"STOP","content":{"parts":[{"text":"done"}]}}]}}',
	},
	{
		category: "finish reasons",
		note: "vertex MAX_TOKENS finish reason",
		payload:
			'{"response":{"candidates":[{"index":0,"finishReason":"MAX_TOKENS","content":{"parts":[{"text":"done"}]}}]}}',
	},
	{
		category: "finish reasons",
		note: "vertex SAFETY finish reason",
		payload:
			'{"response":{"candidates":[{"index":0,"finishReason":"SAFETY","content":{"parts":[{"text":"filtered"}]}}]}}',
	},
	{
		category: "finish reasons",
		note: "vertex malformed function finish reason",
		payload:
			'{"response":{"candidates":[{"index":0,"finishReason":"MALFORMED_FUNCTION_CALL","content":{"parts":[{"text":"bad"}]}}]}}',
	},
	{
		category: "unknown keys",
		note: "unknown vertex envelope preserved as metadata",
		payload: '{"vertexTraceId":"trace-gv-1","status":"OK"}',
	},
	{
		category: "errors",
		note: "response wrapper error payload",
		payload: '{"response":{"error":{"message":"quota","code":429}}}',
	},
	{
		category: "errors",
		note: "response wrapper promptFeedback",
		payload: '{"response":{"promptFeedback":{"blockReason":"SAFETY"}}}',
	},
	{
		category: "partial tools",
		note: "wrapped functionCall args object",
		payload:
			'{"response":{"candidates":[{"index":0,"content":{"parts":[{"functionCall":{"id":"gv_tool_1","name":"search","args":{"q":"vertex"}}}]}}]}}',
	},
	{
		category: "partial tools",
		note: "wrapped functionCall partial continue",
		payload:
			'{"response":{"candidates":[{"index":0,"content":{"parts":[{"functionCall":{"id":"gv_tool_2","name":"lookup","partialArgs":[{"stringValue":"{\\"k\\":\\"ve","willContinue":true}],"willContinue":true}}]}}]}}',
	},
	{
		category: "partial tools",
		note: "wrapped continuation close",
		payload:
			'{"response":{"candidates":[{"index":0,"content":{"parts":[{"functionCall":{"id":"gv_tool_2","partialArgs":[{"stringValue":"rtex\\"}"}]}}]}}]}}',
		prelude: [
			'{"response":{"candidates":[{"index":0,"content":{"parts":[{"functionCall":{"id":"gv_tool_2","name":"lookup","partialArgs":[{"stringValue":"{\\"k\\":\\"ve","willContinue":true}],"willContinue":true}}]}}]}}',
		],
	},
	{
		category: "citations",
		note: "wrapped citation metadata",
		payload:
			'{"response":{"candidates":[{"index":0,"citationMetadata":{"citations":[{"id":"v1"}]},"content":{"parts":[{"text":"c1"}]}}]}}',
	},
	{
		category: "citations",
		note: "wrapped grounding metadata",
		payload:
			'{"response":{"candidates":[{"index":0,"groundingMetadata":{"webSearchQueries":["vertex query"]},"content":{"parts":[{"text":"g1"}]}}]}}',
	},
	{
		category: "citations",
		note: "wrapped citation + grounding",
		payload:
			'{"response":{"candidates":[{"index":0,"citationMetadata":{"citations":[{"id":"v2"}]},"groundingMetadata":{"webSearchQueries":["q2"]},"content":{"parts":[{"text":"cg"}]}}]}}',
	},
	{
		category: "multichoice",
		note: "wrapped two choices text",
		payload:
			'{"response":{"candidates":[{"index":0,"content":{"parts":[{"text":"left"}]}},{"index":1,"content":{"parts":[{"text":"right"}]}}]}}',
	},
	{
		category: "multichoice",
		note: "wrapped non-sequential indexes",
		payload:
			'{"response":{"candidates":[{"index":2,"content":{"parts":[{"text":"two"}]}},{"index":4,"content":{"parts":[{"text":"four"}]}}]}}',
	},
	{
		category: "whitespace",
		note: "wrapped whitespace text",
		payload: '{"response":{"candidates":[{"index":0,"content":{"parts":[{"text":"   "}]}}]}}',
	},
	{
		category: "reasoning",
		note: "wrapped thought part",
		payload:
			'{"response":{"candidates":[{"index":0,"content":{"parts":[{"thought":true,"text":"vertex-think"}]}}]}}',
	},
	{
		category: "logprobs",
		note: "wrapped unknown logprob field tolerated",
		payload:
			'{"response":{"candidates":[{"index":0,"logprobsResult":{"tokens":[{"token":"v","logprob":-0.5}]},"content":{"parts":[{"text":"logprob"}]}}]}}',
	},
	{
		category: "usage-only",
		note: "wrapped usage and text",
		payload:
			'{"response":{"usageMetadata":{"promptTokenCount":1,"candidatesTokenCount":1},"candidates":[{"index":0,"content":{"parts":[{"text":"combo"}]}}]}}',
	},
	{
		category: "message.start",
		note: "responseId only wrapped",
		payload: '{"response":{"responseId":"gv_meta_2","candidates":[]}}',
	},
	{
		category: "message.start",
		note: "modelVersion only wrapped",
		payload: '{"response":{"modelVersion":"gemini-2.5-pro","candidates":[]}}',
	},
	{
		category: "unknown keys",
		note: "wrapped empty candidates",
		payload: '{"response":{"responseId":"gv_empty","candidates":[]}}',
	},
	{
		category: "unknown keys",
		note: "wrapped inlineData ignored",
		payload:
			'{"response":{"candidates":[{"index":0,"content":{"parts":[{"inlineData":{"mimeType":"image/png","data":"AQ=="}}]}}]}}',
	},
	{
		category: "unknown keys",
		note: "wrapped functionResponse ignored",
		payload:
			'{"response":{"candidates":[{"index":0,"content":{"parts":[{"functionResponse":{"name":"x","response":{"ok":true}}}]}}]}}',
	},
	{
		category: "unknown keys",
		note: "wrapped custom part ignored",
		payload: '{"response":{"candidates":[{"index":0,"content":{"parts":[{"custom":"field"}]}}]}}',
	},
	{
		category: "usage-only",
		note: "result wrapper usage and metadata",
		payload:
			'{"result":{"responseId":"gv_result_meta","usageMetadata":{"promptTokenCount":9,"candidatesTokenCount":1}}}',
	},
	{
		category: "errors",
		note: "predictions wrapper promptFeedback block",
		payload: '{"predictions":[{"promptFeedback":{"blockReason":"SAFETY"}}]}',
	},
	{
		category: "unknown keys",
		note: "response wrapper unknown keys with candidates",
		payload:
			'{"response":{"responseId":"gv_unknown","mystery":{"x":1},"candidates":[{"index":0,"content":{"parts":[{"text":"known"}]}}]}}',
	},
	{
		category: "partial tools",
		note: "partial arg number value wrapped",
		payload:
			'{"response":{"candidates":[{"index":0,"content":{"parts":[{"functionCall":{"id":"gv_tool_num","name":"set","partialArgs":[{"jsonPath":"$.n","numberValue":8}]}}]}}]}}',
	},
	{
		category: "partial tools",
		note: "partial arg bool value wrapped",
		payload:
			'{"response":{"candidates":[{"index":0,"content":{"parts":[{"functionCall":{"id":"gv_tool_bool","name":"set","partialArgs":[{"jsonPath":"$.ok","boolValue":true}]}}]}}]}}',
	},
	{
		category: "partial tools",
		note: "partial arg null value wrapped",
		payload:
			'{"response":{"candidates":[{"index":0,"content":{"parts":[{"functionCall":{"id":"gv_tool_null","name":"set","partialArgs":[{"jsonPath":"$.x","nullValue":0}]}}]}}]}}',
	},
	{
		category: "text",
		note: "wrapped multiline text",
		payload: '{"response":{"candidates":[{"index":0,"content":{"parts":[{"text":"v1\\nv2"}]}}]}}',
	},
]);

const bedrockRows = buildRows("B", 93, [
	{
		category: "message.start",
		note: "messageStart assistant",
		payload: '{"messageStart":{"role":"assistant"}}',
	},
	{
		category: "message.start",
		note: "messageStart with alternate role",
		payload: '{"messageStart":{"role":"model"}}',
	},
	{
		category: "text",
		note: "contentBlockDelta text basic",
		payload: '{"contentBlockDelta":{"contentBlockIndex":0,"delta":{"text":"hello"}}}',
	},
	{
		category: "text",
		note: "contentBlockDelta text unicode",
		payload: '{"contentBlockDelta":{"contentBlockIndex":0,"delta":{"text":"Ahoj 😀"}}}',
	},
	{
		category: "partial tools",
		note: "contentBlockStart toolUse",
		payload:
			'{"contentBlockStart":{"contentBlockIndex":1,"start":{"toolUse":{"toolUseId":"b_tool_1","name":"search"}}}}',
	},
	{
		category: "partial tools",
		note: "toolUse string input delta",
		payload:
			'{"contentBlockDelta":{"contentBlockIndex":1,"delta":{"toolUse":{"input":"{\\"q\\":\\"bed"}}}}',
		prelude: [
			'{"contentBlockStart":{"contentBlockIndex":1,"start":{"toolUse":{"toolUseId":"b_tool_2","name":"search"}}}}',
		],
	},
	{
		category: "partial tools",
		note: "toolUse object input delta",
		payload:
			'{"contentBlockDelta":{"contentBlockIndex":1,"delta":{"toolUse":{"input":{"q":"bedrock"}}}}}',
		prelude: [
			'{"contentBlockStart":{"contentBlockIndex":1,"start":{"toolUse":{"toolUseId":"b_tool_3","name":"search"}}}}',
		],
	},
	{
		category: "partial tools",
		note: "contentBlockStop closes tool",
		payload: '{"contentBlockStop":{"contentBlockIndex":1}}',
		prelude: [
			'{"contentBlockStart":{"contentBlockIndex":1,"start":{"toolUse":{"toolUseId":"b_tool_4","name":"search"}}}}',
		],
	},
	{
		category: "finish reasons",
		note: "messageStop end_turn",
		payload: '{"messageStop":{"stopReason":"end_turn"}}',
	},
	{
		category: "finish reasons",
		note: "messageStop max_tokens",
		payload: '{"messageStop":{"stopReason":"max_tokens"}}',
	},
	{
		category: "finish reasons",
		note: "messageStop tool_use",
		payload: '{"messageStop":{"stopReason":"tool_use"}}',
	},
	{
		category: "usage-only",
		note: "metadata usage input output",
		payload: '{"metadata":{"usage":{"inputTokens":10,"outputTokens":5}}}',
	},
	{
		category: "usage-only",
		note: "metadata usage total only",
		payload: '{"metadata":{"usage":{"totalTokenCount":33}}}',
	},
	{
		category: "unknown keys",
		note: "metadata metrics and trace",
		payload: '{"metadata":{"metrics":{"latencyMs":120},"trace":{"requestId":"abc"}}}',
	},
	{
		category: "errors",
		note: "internalServerException payload",
		payload: '{"internalServerException":{"message":"boom"}}',
	},
	{
		category: "errors",
		note: "validationException payload",
		payload: '{"validationException":{"message":"bad input"}}',
	},
	{
		category: "unknown keys",
		note: "unknown object falls back metadata",
		payload: '{"oddEnvelope":{"value":1}}',
	},
	{
		category: "reasoning",
		note: "reasoningContent text",
		payload:
			'{"contentBlockDelta":{"contentBlockIndex":0,"delta":{"reasoningContent":{"text":"reason"}}}}',
	},
	{
		category: "reasoning",
		note: "reasoningContent thinking ignored in auto-default",
		payload:
			'{"contentBlockDelta":{"contentBlockIndex":0,"delta":{"reasoningContent":{"thinking":"internal"}}}}',
	},
	{
		category: "text",
		note: "json-like text delta",
		payload: '{"contentBlockDelta":{"contentBlockIndex":0,"delta":{"text":"{\\"k\\":"}}}',
	},
	{
		category: "usage-only",
		note: "metadata usage empty ignored",
		payload: '{"metadata":{"usage":{}}}',
	},
	{
		category: "usage-only",
		note: "metadata usage inputTokenCount alias",
		payload: '{"metadata":{"usage":{"inputTokenCount":4,"outputTokenCount":2}}}',
	},
	{
		category: "unknown keys",
		note: "contentBlockStart without toolUse",
		payload: '{"contentBlockStart":{"contentBlockIndex":3,"start":{"text":"noop"}}}',
	},
	{
		category: "unknown keys",
		note: "contentBlockDelta missing delta record",
		payload: '{"contentBlockDelta":{"contentBlockIndex":3}}',
	},
	{
		category: "message.start",
		note: "messageStart without role",
		payload: '{"messageStart":{}}',
	},
	{
		category: "multichoice",
		note: "non-zero contentBlockIndex text",
		payload: '{"contentBlockDelta":{"contentBlockIndex":2,"delta":{"text":"index-two"}}}',
	},
	{
		category: "multichoice",
		note: "non-zero tool index start",
		payload:
			'{"contentBlockStart":{"contentBlockIndex":4,"start":{"toolUse":{"toolUseId":"b_tool_4a","name":"idx4"}}}}',
	},
	{
		category: "finish reasons",
		note: "messageStop with additionalModelResponseFields",
		payload:
			'{"messageStop":{"stopReason":"end_turn","additionalModelResponseFields":{"stop_sequence":"###"}}}',
	},
	{
		category: "partial tools",
		note: "incremental toolUse args second chunk",
		payload:
			'{"contentBlockDelta":{"contentBlockIndex":5,"delta":{"toolUse":{"input":"{\\"a\\":1,\\"b\\":2}"}}}}',
		prelude: [
			'{"contentBlockStart":{"contentBlockIndex":5,"start":{"toolUse":{"toolUseId":"b_tool_5","name":"merge"}}}}',
			'{"contentBlockDelta":{"contentBlockIndex":5,"delta":{"toolUse":{"input":"{\\"a\\":1"}}}}',
		],
	},
	{
		category: "unknown keys",
		note: "metadata trace only",
		payload: '{"metadata":{"trace":{"route":"x"}}}',
	},
	{
		category: "unknown keys",
		note: "metadata metrics only",
		payload: '{"metadata":{"metrics":{"latencyMs":88}}}',
	},
	{
		category: "errors",
		note: "serviceUnavailableException payload",
		payload: '{"serviceUnavailableException":{"message":"retry later"}}',
	},
	{
		category: "errors",
		note: "throttlingException payload",
		payload: '{"throttlingException":{"message":"slow down"}}',
	},
	{
		category: "errors",
		note: "modelStreamErrorException payload",
		payload: '{"modelStreamErrorException":{"message":"stream failure"}}',
	},
	{
		category: "citations",
		note: "citation-like trace payload",
		payload: '{"metadata":{"trace":{"citations":[{"url":"https://cite.test"}]}}}',
	},
	{
		category: "logprobs",
		note: "logprob-like trace payload",
		payload: '{"metadata":{"trace":{"logprobs":[{"token":"x","logprob":-0.1}]}}}',
	},
	{
		category: "text",
		note: "multiline text delta",
		payload: '{"contentBlockDelta":{"contentBlockIndex":0,"delta":{"text":"l1\\nl2"}}}',
	},
]);

const cohereRows = buildRows("CO", 119, [
	{
		category: "message.start",
		note: "message-start baseline",
		payload: '{"type":"message-start","id":"co_msg_1","delta":{"message":{"role":"assistant"}}}',
	},
	{
		category: "text",
		note: "content-delta basic",
		payload: '{"type":"content-delta","index":0,"delta":{"message":{"content":{"text":"hello"}}}}',
	},
	{
		category: "text",
		note: "content-delta unicode",
		payload: '{"type":"content-delta","index":0,"delta":{"message":{"content":{"text":"čau 😀"}}}}',
	},
	{
		category: "reasoning",
		note: "tool-plan-delta",
		payload: '{"type":"tool-plan-delta","delta":{"message":{"tool_plan":"I will call a tool"}}}',
	},
	{
		category: "partial tools",
		note: "tool-call-start single object",
		payload:
			'{"type":"tool-call-start","index":0,"delta":{"message":{"tool_calls":{"id":"co_tool_1","type":"function","function":{"name":"search","arguments":""}}}}}',
	},
	{
		category: "partial tools",
		note: "tool-call-delta after start",
		payload:
			'{"type":"tool-call-delta","index":0,"delta":{"message":{"tool_calls":{"function":{"arguments":"{\\"q\\":\\"co"}}}}}',
		prelude: [
			'{"type":"tool-call-start","index":0,"delta":{"message":{"tool_calls":{"id":"co_tool_2","type":"function","function":{"name":"search","arguments":""}}}}}',
		],
	},
	{
		category: "partial tools",
		note: "tool-call-end after start",
		payload: '{"type":"tool-call-end","index":0}',
		prelude: [
			'{"type":"tool-call-start","index":0,"delta":{"message":{"tool_calls":{"id":"co_tool_3","type":"function","function":{"name":"search","arguments":""}}}}}',
		],
	},
	{
		category: "citations",
		note: "citation-start span payload",
		payload:
			'{"type":"citation-start","index":0,"delta":{"message":{"citations":{"start":0,"end":4,"text":"cite"}}}}',
	},
	{
		category: "finish reasons",
		note: "message-end COMPLETE",
		payload:
			'{"type":"message-end","delta":{"finish_reason":"COMPLETE","usage":{"billed_units":{"input_tokens":12,"output_tokens":4}}}}',
	},
	{
		category: "finish reasons",
		note: "message-end MAX_TOKENS",
		payload: '{"type":"message-end","delta":{"finish_reason":"MAX_TOKENS"}}',
	},
	{
		category: "finish reasons",
		note: "message-end TOOL_CALL",
		payload: '{"type":"message-end","delta":{"finish_reason":"TOOL_CALL"}}',
	},
	{
		category: "finish reasons",
		note: "message-end ERROR",
		payload: '{"type":"message-end","delta":{"finish_reason":"ERROR"}}',
	},
	{
		category: "errors",
		note: "type error payload",
		payload: '{"type":"error","error":{"message":"cohere overloaded"}}',
	},
	{
		category: "unknown keys",
		note: "unknown event type fallback metadata",
		payload: '{"type":"mystery-event","mystery":{"x":1}}',
	},
	{
		category: "unknown keys",
		note: "missing type fallback metadata",
		payload: '{"mystery":"no-type"}',
	},
	{
		category: "whitespace",
		note: "empty content text ignored",
		payload: '{"type":"content-delta","index":0,"delta":{"message":{"content":{"text":""}}}}',
	},
	{
		category: "multichoice",
		note: "content-delta index one",
		payload: '{"type":"content-delta","index":1,"delta":{"message":{"content":{"text":"one"}}}}',
	},
	{
		category: "multichoice",
		note: "tool-call-start index two",
		payload:
			'{"type":"tool-call-start","index":2,"delta":{"message":{"tool_calls":{"id":"co_tool_2x","type":"function","function":{"name":"fetch","arguments":""}}}}}',
	},
	{
		category: "partial tools",
		note: "tool-call-delta with late id",
		payload:
			'{"type":"tool-call-delta","index":3,"delta":{"message":{"tool_calls":{"id":"co_tool_late","function":{"arguments":"{\\"a\\":1}"}}}}}',
	},
	{
		category: "partial tools",
		note: "tool-call-end with late id",
		payload:
			'{"type":"tool-call-end","index":3,"delta":{"message":{"tool_calls":{"id":"co_tool_late"}}}}',
		prelude: [
			'{"type":"tool-call-start","index":3,"delta":{"message":{"tool_calls":{"id":"co_tool_3x","type":"function","function":{"name":"late","arguments":""}}}}}',
		],
	},
	{
		category: "usage-only",
		note: "usage tokens object",
		payload:
			'{"type":"message-end","delta":{"usage":{"tokens":{"input_tokens":2,"output_tokens":3}}}}',
	},
	{
		category: "usage-only",
		note: "usage billed_units object",
		payload:
			'{"type":"message-end","delta":{"usage":{"billed_units":{"input_tokens":5,"output_tokens":6}}}}',
	},
	{
		category: "citations",
		note: "citation with sources",
		payload:
			'{"type":"citation-start","index":1,"delta":{"message":{"citations":{"text":"src","sources":[{"type":"web","url":"https://x.test"}]}}}}',
	},
	{
		category: "citations",
		note: "citation text only",
		payload:
			'{"type":"citation-start","index":2,"delta":{"message":{"citations":{"text":"snippet"}}}}',
	},
	{
		category: "logprobs",
		note: "content delta with logprob-like extras",
		payload:
			'{"type":"content-delta","index":0,"delta":{"message":{"content":{"text":"lp"},"logprobs":[{"token":"lp","logprob":-0.1}]}}}',
	},
	{
		category: "partial tools",
		note: "tool args first slice",
		payload:
			'{"type":"tool-call-delta","index":4,"delta":{"message":{"tool_calls":{"function":{"arguments":"{\\"k\\":\\"v"}}}}}',
		prelude: [
			'{"type":"tool-call-start","index":4,"delta":{"message":{"tool_calls":{"id":"co_tool_4","type":"function","function":{"name":"merge","arguments":""}}}}}',
		],
	},
	{
		category: "partial tools",
		note: "tool args second slice incremental",
		payload:
			'{"type":"tool-call-delta","index":4,"delta":{"message":{"tool_calls":{"function":{"arguments":"{\\"k\\":\\"value\\"}"}}}}}',
		prelude: [
			'{"type":"tool-call-start","index":4,"delta":{"message":{"tool_calls":{"id":"co_tool_5","type":"function","function":{"name":"merge","arguments":""}}}}}',
			'{"type":"tool-call-delta","index":4,"delta":{"message":{"tool_calls":{"function":{"arguments":"{\\"k\\":\\"v"}}}}}',
		],
	},
	{
		category: "usage-only",
		note: "message-end usage no finish reason",
		payload:
			'{"type":"message-end","delta":{"usage":{"billed_units":{"input_tokens":1,"output_tokens":1}}}}',
	},
	{
		category: "finish reasons",
		note: "message-end finish only",
		payload: '{"type":"message-end","delta":{"finish_reason":"STOP_SEQUENCE"}}',
	},
	{
		category: "unknown keys",
		note: "message-start unknown extras",
		payload:
			'{"type":"message-start","id":"co_extra","delta":{"message":{"role":"assistant"}},"mystery":{"deep":true}}',
	},
	{
		category: "unknown keys",
		note: "citation-end ignored",
		payload: '{"type":"citation-end","index":0}',
	},
	{
		category: "unknown keys",
		note: "content-start ignored",
		payload: '{"type":"content-start","index":0}',
	},
	{
		category: "unknown keys",
		note: "content-end ignored",
		payload: '{"type":"content-end","index":0}',
	},
	{
		category: "multichoice",
		note: "tool-call-start array payload",
		payload:
			'{"type":"tool-call-start","index":5,"delta":{"message":{"tool_calls":[{"id":"co_tool_a","type":"function","function":{"name":"a","arguments":""}},{"id":"co_tool_b","type":"function","function":{"name":"b","arguments":""}}]}}}',
	},
	{
		category: "multichoice",
		note: "tool-call-delta array payload",
		payload:
			'{"type":"tool-call-delta","index":5,"delta":{"message":{"tool_calls":[{"id":"co_tool_a","function":{"arguments":"{\\"x\\":1}"}}]}}}',
		prelude: [
			'{"type":"tool-call-start","index":5,"delta":{"message":{"tool_calls":[{"id":"co_tool_a","type":"function","function":{"name":"a","arguments":""}}]}}}',
		],
	},
	{
		category: "multichoice",
		note: "tool-call-end after array start",
		payload: '{"type":"tool-call-end","index":5}',
		prelude: [
			'{"type":"tool-call-start","index":5,"delta":{"message":{"tool_calls":[{"id":"co_tool_c","type":"function","function":{"name":"c","arguments":""}}]}}}',
		],
	},
	{
		category: "text",
		note: "multiline content text",
		payload:
			'{"type":"content-delta","index":0,"delta":{"message":{"content":{"text":"l1\\nl2"}}}}',
	},
]);

export const parseChunkPayloads: Record<ParseChunkAdapterName, ParseChunkPayloadCase[]> = {
	"openai-chat": [...sharedGates["openai-chat"], ...openAIChatRows],
	"openai-responses": [...sharedGates["openai-responses"], ...openAIResponsesRows],
	anthropic: [...sharedGates.anthropic, ...anthropicRows],
	gemini: [...sharedGates.gemini, ...geminiRows],
	"gemini-vertex": [...sharedGates["gemini-vertex"], ...geminiVertexRows],
	bedrock: [...sharedGates.bedrock, ...bedrockRows],
	cohere: [...sharedGates.cohere, ...cohereRows],
};

export const parseChunkAdapters = Object.keys(parseChunkPayloads) as ParseChunkAdapterName[];

function buildRows(prefix: string, start: number, rows: DraftRow[]): ParseChunkPayloadCase[] {
	return rows.map((row, index) => ({
		id: `${prefix}${start + index}`,
		category: row.category,
		note: row.note,
		payload: row.payload,
		prelude: row.prelude,
	}));
}
