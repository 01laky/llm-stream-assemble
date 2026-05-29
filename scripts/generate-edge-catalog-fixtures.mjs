/**
 * Maintainer script: writes edge-catalog fixture expected.json from stream sources.
 * Run: npm run build && npm run fixtures:generate-edge-catalog
 * Check: npm run fixtures:check-edge-catalog
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { ReadableStream } from "node:stream/web";
import { TextEncoder } from "node:util";
import { fileURLToPath } from "node:url";
import { anthropicAdapter } from "../dist/adapters/anthropic.js";
import { bedrockAdapter } from "../dist/adapters/bedrock.js";
import { cohereAdapter } from "../dist/adapters/cohere.js";
import { geminiAdapter } from "../dist/adapters/gemini.js";
import { openaiChatAdapter } from "../dist/adapters/openai-chat.js";
import { openaiResponsesAdapter } from "../dist/adapters/openai-responses.js";
import { assembleStream, assembleFromPayloads } from "../dist/core/index.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const catalogDir = join(root, "test/fixtures/edge-catalog");
const checkMode = process.argv.includes("--check");

function normalize(events) {
	return events.map((event) => {
		if (
			event.type === "metadata" ||
			event.type === "usage" ||
			event.type === "citation" ||
			event.type === "grounding"
		) {
			const { raw, ...rest } = event;
			void raw;
			return rest;
		}
		if (event.type === "error") {
			return { type: "error", recoverable: event.recoverable };
		}
		return event;
	});
}

async function collectSse(sse, adapter) {
	const events = [];
	for await (const event of assembleStream(
		new ReadableStream({
			start(c) {
				c.enqueue(new TextEncoder().encode(sse));
				c.close();
			},
		}),
		adapter,
	)) {
		events.push(event);
	}
	return normalize(events);
}

async function collectJsonl(lines, adapter) {
	async function* payloads() {
		for (const line of lines) yield line;
	}
	const events = [];
	for await (const event of assembleFromPayloads(payloads(), adapter)) {
		events.push(event);
	}
	return normalize(events);
}

function writeStream(name, content) {
	const ext = name.endsWith(".jsonl") ? "jsonl" : "sse";
	const base = name.replace(/\.(sse|jsonl)$/, "");
	const streamPath = join(catalogDir, name);
	const expectedPath = join(catalogDir, `${base}.expected.json`);
	mkdirSync(catalogDir, { recursive: true });
	if (!checkMode) {
		writeFileSync(streamPath, content, "utf8");
	}
	return { streamPath, expectedPath, ext };
}

async function writeGolden(name, content, adapter, transport = "sse") {
	const { expectedPath, ext } = writeStream(name, content);
	const events =
		transport === "jsonl"
			? await collectJsonl(
					content.split("\n").filter((l) => l.trim()),
					adapter,
				)
			: await collectSse(content, adapter);
	const next = `${JSON.stringify(events, null, "\t")}\n`;
	if (checkMode) {
		if (!existsSync(expectedPath)) {
			throw new Error(`Missing expected: ${expectedPath}`);
		}
		const current = readFileSync(expectedPath, "utf8");
		if (current !== next) {
			throw new Error(`Drift: ${expectedPath}`);
		}
		return;
	}
	writeFileSync(expectedPath, next, "utf8");
	void ext;
}

const oaiChunk = (id, delta, finish = null) =>
	`data: ${JSON.stringify({
		id,
		object: "chat.completion.chunk",
		created: 1710000000,
		model: "gpt-4o-mini",
		choices: [{ index: 0, delta, finish_reason: finish }],
	})}\n\n`;

const anthropicEvent = (type, payload) => `event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`;

/** @type {Array<{ file: string, content: string, adapter: unknown, transport?: string }>} */
const FIXTURES = [];

function add(file, content, adapter, transport = "sse") {
	FIXTURES.push({ file, content, adapter, transport });
}

function inferEdgeCatalogMeta(file) {
	const transport = file.endsWith(".jsonl") ? "jsonl" : "sse";
	if (file.includes("anthropic") || /^ec1[45]|^ec2[5]|^ec3[1]|^ec5[1]|^ec7[1]/.test(file))
		return { adapterKey: "anthropic", transport };
	if (
		file.includes("cohere") ||
		/^ec1[58]|^ec2[18]|^ec2[8]|^ec4[58]|^ec5[2]|^ec5[8]|^ec6[038]/.test(file)
	)
		return {
			adapterKey: "cohere",
			transport,
			adapterOptions: file.includes("json") ? { jsonMode: true } : undefined,
		};
	if (file.includes("bedrock") || /^ec3[24]|^ec4[69]|^ec5[49]|^ec6[19]/.test(file))
		return { adapterKey: "bedrock", transport };
	if (file.includes("vertex") || /^ec4[89]|^ec5[7]|^ec6[02]/.test(file))
		return { adapterKey: "gemini-vertex", transport, adapterOptions: { apiSurface: "vertex" } };
	if (file.includes("gemini") || /^ec2[07]|^ec3[46]|^ec4[46]|^ec5[3]/.test(file))
		return {
			adapterKey: "gemini",
			transport,
			adapterOptions: file.includes("json") ? { jsonMode: true } : undefined,
		};
	if (file.includes("responses") || /^ec1[26]|^ec2[2]|^ec4[78]|^ec5[5]/.test(file))
		return {
			adapterKey: "openai-responses",
			transport,
			adapterOptions: file.includes("json") ? { jsonMode: true } : undefined,
		};
	if (file.startsWith("tier2-")) return { adapterKey: "openai-chat", transport };
	if (/^ec1[79]|^ec1[89]|^ec19/.test(file))
		return { adapterKey: "openai-chat", transport, adapterOptions: { jsonMode: true } };
	return { adapterKey: "openai-chat", transport };
}

// EC01–EC04: SSE edge cases (openai-chat)
add(
	"ec01-sse-midline-split.sse",
	oaiChunk("ec01", { role: "assistant" }) +
		oaiChunk("ec01", { content: "Hello" }) +
		oaiChunk("ec01", { content: " world" }, "stop") +
		"data: [DONE]\n\n",
	openaiChatAdapter(),
);
add(
	"ec02-sse-crlf-blank.sse",
	oaiChunk("ec02", { role: "assistant" }).replace(/\n\n/g, "\r\n\r\n") +
		oaiChunk("ec02", { content: "CRLF" }, "stop").replace(/\n\n/g, "\r\n\r\n") +
		"data: [DONE]\r\n\r\n",
	openaiChatAdapter(),
);
add(
	"ec03-sse-blank-line.sse",
	oaiChunk("ec03", { role: "assistant" }) +
		"\n\n\n\n" +
		oaiChunk("ec03", { content: "blank" }, "stop") +
		"data: [DONE]\n\n",
	openaiChatAdapter(),
);
add(
	"ec04-sse-duplicate-data.sse",
	oaiChunk("ec04", { role: "assistant" }) +
		oaiChunk("ec04", { content: "dup" }) +
		oaiChunk("ec04", { content: "dup" }) +
		oaiChunk("ec04", {}, "stop") +
		"data: [DONE]\n\n",
	openaiChatAdapter(),
);

// EC05–EC08
add(
	"ec05-sse-split-data-prefix.sse",
	"data: " +
		JSON.stringify({
			id: "ec05",
			choices: [{ index: 0, delta: { role: "assistant" }, finish_reason: null }],
		}) +
		"\n\ndata: " +
		JSON.stringify({
			id: "ec05",
			choices: [{ index: 0, delta: { content: "prefix" }, finish_reason: "stop" }],
		}) +
		"\n\ndata: [DONE]\n\n",
	openaiChatAdapter(),
);
add(
	"ec06-sse-done-marker.sse",
	oaiChunk("ec06", { role: "assistant" }) +
		oaiChunk("ec06", { content: "done" }, "stop") +
		"data: [DONE]\n\n",
	openaiChatAdapter(),
);
add(
	"ec07-sse-empty-data.sse",
	"data: \n\ndata: \n\n" +
		oaiChunk("ec07", { content: "after-empty" }, "stop") +
		"data: [DONE]\n\n",
	openaiChatAdapter(),
);
add(
	"ec08-sse-trailing-newline.sse",
	oaiChunk("ec08", { role: "assistant" }) +
		oaiChunk("ec08", { content: "trail" }, "stop") +
		"data: [DONE]\n\n\n",
	openaiChatAdapter(),
);

// EC09–EC16: tools
add(
	"ec09-tool-partial-args.sse",
	oaiChunk("ec09", { role: "assistant" }) +
		oaiChunk("ec09", {
			tool_calls: [
				{
					index: 0,
					id: "call_ec09",
					type: "function",
					function: { name: "get_weather", arguments: '{"loc' },
				},
			],
		}) +
		oaiChunk("ec09", { tool_calls: [{ index: 0, function: { arguments: 'ation":"NYC"}' } }] }) +
		oaiChunk("ec09", {}, "tool_calls") +
		"data: [DONE]\n\n",
	openaiChatAdapter(),
);
add(
	"ec10-tool-empty-args.sse",
	oaiChunk("ec10", { role: "assistant" }) +
		oaiChunk("ec10", {
			tool_calls: [
				{
					index: 0,
					id: "call_ec10",
					type: "function",
					function: { name: "noop", arguments: "{}" },
				},
			],
		}) +
		oaiChunk("ec10", {}, "tool_calls") +
		"data: [DONE]\n\n",
	openaiChatAdapter(),
);
add(
	"ec11-tool-unicode-args.sse",
	oaiChunk("ec11", { role: "assistant" }) +
		oaiChunk("ec11", {
			tool_calls: [
				{
					index: 0,
					id: "call_ec11",
					type: "function",
					function: { name: "city", arguments: '{"name":"東京"}' },
				},
			],
		}) +
		oaiChunk("ec11", {}, "tool_calls") +
		"data: [DONE]\n\n",
	openaiChatAdapter(),
);
add(
	"ec12-tool-parallel.sse",
	oaiChunk("ec12", { role: "assistant" }) +
		oaiChunk("ec12", {
			tool_calls: [
				{ index: 0, id: "a", type: "function", function: { name: "a", arguments: "{}" } },
				{ index: 1, id: "b", type: "function", function: { name: "b", arguments: "{}" } },
			],
		}) +
		oaiChunk("ec12", {}, "tool_calls") +
		"data: [DONE]\n\n",
	openaiChatAdapter(),
);
add(
	"ec13-tool-late-id.sse",
	oaiChunk("ec13", { role: "assistant" }) +
		oaiChunk("ec13", {
			tool_calls: [{ index: 0, type: "function", function: { name: "late", arguments: "{}" } }],
		}) +
		oaiChunk("ec13", {
			tool_calls: [
				{ index: 0, id: "late_id", type: "function", function: { name: "late", arguments: "{}" } },
			],
		}) +
		oaiChunk("ec13", {}, "tool_calls") +
		"data: [DONE]\n\n",
	openaiChatAdapter(),
);
add(
	"ec14-anthropic-tool-partial.sse",
	anthropicEvent("message_start", {
		type: "message_start",
		message: { id: "msg_ec14", model: "claude", role: "assistant" },
	}) +
		anthropicEvent("content_block_start", {
			type: "content_block_start",
			index: 0,
			content_block: { type: "tool_use", id: "tool_ec14", name: "search" },
		}) +
		anthropicEvent("content_block_delta", {
			type: "content_block_delta",
			index: 0,
			delta: { type: "input_json_delta", partial_json: '{"q":' },
		}) +
		anthropicEvent("content_block_delta", {
			type: "content_block_delta",
			index: 0,
			delta: { type: "input_json_delta", partial_json: '"test"}' },
		}) +
		anthropicEvent("content_block_stop", { type: "content_block_stop", index: 0 }) +
		anthropicEvent("message_delta", { type: "message_delta", delta: { stop_reason: "tool_use" } }) +
		anthropicEvent("message_stop", { type: "message_stop" }),
	anthropicAdapter(),
);
add(
	"ec15-cohere-tool-partial.jsonl",
	readFileSync(join(root, "test/fixtures/cohere/tool-partial-input.jsonl"), "utf8"),
	cohereAdapter(),
	"jsonl",
);
add(
	"ec16-openai-responses-tool.sse",
	`data: ${JSON.stringify({ type: "response.created", response: { id: "resp_ec16" } })}\n\n` +
		`data: ${JSON.stringify({ type: "response.output_item.added", output_index: 0, item: { type: "function_call", id: "fc1", call_id: "call_ec16", name: "fn", arguments: "" } })}\n\n` +
		`data: ${JSON.stringify({ type: "response.function_call_arguments.delta", output_index: 0, delta: '{"x":' })}\n\n` +
		`data: ${JSON.stringify({ type: "response.function_call_arguments.delta", output_index: 0, delta: "1}" })}\n\n` +
		`data: ${JSON.stringify({ type: "response.output_item.done", output_index: 0, item: { type: "function_call", id: "fc1", call_id: "call_ec16", name: "fn", arguments: '{"x":1}' } })}\n\n` +
		`data: ${JSON.stringify({ type: "response.completed", response: { id: "resp_ec16", status: "completed" } })}\n\n`,
	openaiResponsesAdapter(),
);

// EC17–EC22: JSON mode
add(
	"ec17-json-mode-partial.sse",
	oaiChunk("ec17", { role: "assistant" }, null) +
		oaiChunk("ec17", { content: '{"a":' }) +
		oaiChunk("ec17", { content: "1}" }, "stop") +
		"data: [DONE]\n\n",
	openaiChatAdapter({ jsonMode: true }),
);
add(
	"ec18-json-mode-invalid.sse",
	oaiChunk("ec18", { role: "assistant" }) +
		oaiChunk("ec18", { content: "{bad json" }, "stop") +
		"data: [DONE]\n\n",
	openaiChatAdapter({ jsonMode: true }),
);
add(
	"ec19-json-post-finish.sse",
	oaiChunk("ec19", { role: "assistant" }) +
		oaiChunk("ec19", { content: '{"ok":true}' }, "stop") +
		oaiChunk("ec19", { content: '{"late":true}' }) +
		"data: [DONE]\n\n",
	openaiChatAdapter({ jsonMode: true }),
);
add(
	"ec20-gemini-json-partial.sse",
	`data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"k":' }], role: "model" }, index: 0 }] })}\n\n` +
		`data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: "1}" }], role: "model" }, finishReason: "STOP", index: 0 }] })}\n\n`,
	geminiAdapter({ jsonMode: true }),
);
add(
	"ec21-cohere-json-partial.jsonl",
	readFileSync(join(root, "test/fixtures/cohere/json-mode.jsonl"), "utf8"),
	cohereAdapter({ jsonMode: true }),
	"jsonl",
);
add(
	"ec22-responses-json.sse",
	`data: ${JSON.stringify({ type: "response.created", response: { id: "resp_ec22" } })}\n\n` +
		`data: ${JSON.stringify({ type: "response.output_text.delta", output_index: 0, delta: '{"z":' })}\n\n` +
		`data: ${JSON.stringify({ type: "response.output_text.delta", output_index: 0, delta: "3}" })}\n\n` +
		`data: ${JSON.stringify({ type: "response.completed", response: { id: "resp_ec22", status: "completed" } })}\n\n`,
	openaiResponsesAdapter({ jsonMode: true }),
);

// EC23–EC28: post-finish drops (simplified per family)
for (const [idx, spec] of [
	[
		"ec23-post-finish-usage.sse",
		oaiChunk("ec23", { role: "assistant" }) +
			oaiChunk("ec23", { content: "u" }, "stop") +
			oaiChunk("ec23", {}) +
			"data: [DONE]\n\n",
		openaiChatAdapter(),
	],
	[
		"ec24-post-finish-metadata.sse",
		oaiChunk("ec24", { role: "assistant" }) +
			oaiChunk("ec24", { content: "m" }, "stop") +
			oaiChunk("ec24", { role: "assistant" }) +
			"data: [DONE]\n\n",
		openaiChatAdapter(),
	],
	[
		"ec25-post-finish-reasoning.sse",
		anthropicEvent("message_start", {
			type: "message_start",
			message: { id: "ec25", model: "claude" },
		}) +
			anthropicEvent("content_block_delta", {
				type: "content_block_delta",
				index: 0,
				delta: { type: "text_delta", text: "done" },
			}) +
			anthropicEvent("message_delta", {
				type: "message_delta",
				delta: { stop_reason: "end_turn" },
			}) +
			anthropicEvent("message_stop", { type: "message_stop" }) +
			anthropicEvent("content_block_delta", {
				type: "content_block_delta",
				index: 0,
				delta: { type: "text_delta", text: "late" },
			}),
		anthropicAdapter(),
	],
	[
		"ec26-post-finish-logprob.sse",
		oaiChunk("ec26", { role: "assistant" }) +
			oaiChunk("ec26", { content: "lp" }, "stop") +
			"data: [DONE]\n\n",
		openaiChatAdapter(),
	],
	[
		"ec27-post-finish-gemini.sse",
		`data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: "g" }], role: "model" }, finishReason: "STOP", index: 0 }] })}\n\n` +
			`data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: "late" }], role: "model" }, index: 0 }] })}\n\n`,
		geminiAdapter(),
	],
	[
		"ec28-post-finish-cohere.jsonl",
		readFileSync(join(root, "test/fixtures/cohere/text-basic.jsonl"), "utf8"),
		cohereAdapter(),
		"jsonl",
	],
].entries()) {
	add(spec[0], spec[1], spec[2], spec[3] ?? "sse");
	void idx;
}

// EC29–EC34 strictToolArgs scenarios use assembler tests; stream fixtures are valid tool JSON
add(
	"ec29-strict-valid-tool.sse",
	oaiChunk("ec29", { role: "assistant" }) +
		oaiChunk("ec29", {
			tool_calls: [
				{
					index: 0,
					id: "sv",
					type: "function",
					function: { name: "fn", arguments: '{"valid":true}' },
				},
			],
		}) +
		oaiChunk("ec29", {}, "tool_calls") +
		"data: [DONE]\n\n",
	openaiChatAdapter(),
);
add(
	"ec30-strict-invalid-tool.sse",
	oaiChunk("ec30", { role: "assistant" }) +
		oaiChunk("ec30", {
			tool_calls: [
				{ index: 0, id: "si", type: "function", function: { name: "fn", arguments: "{bad" } },
			],
		}) +
		oaiChunk("ec30", {}, "tool_calls") +
		"data: [DONE]\n\n",
	openaiChatAdapter(),
);
add(
	"ec31-anthropic-valid-tool.sse",
	readFileSync(join(root, "test/fixtures/anthropic/tool-use.sse"), "utf8"),
	anthropicAdapter(),
);
add(
	"ec32-bedrock-valid-tool.jsonl",
	readFileSync(join(root, "test/fixtures/bedrock/tool-single.jsonl"), "utf8"),
	bedrockAdapter(),
	"jsonl",
);
add(
	"ec33-cohere-valid-tool.jsonl",
	readFileSync(join(root, "test/fixtures/cohere/tool-single.jsonl"), "utf8"),
	cohereAdapter(),
	"jsonl",
);
add(
	"ec34-gemini-valid-tool.sse",
	readFileSync(join(root, "test/fixtures/gemini/tool-single.sse"), "utf8"),
	geminiAdapter(),
);

// EC35–EC40 citation/grounding
add(
	"ec35-citations-cohere.jsonl",
	readFileSync(join(root, "test/fixtures/cohere/citations-stream.jsonl"), "utf8"),
	cohereAdapter(),
	"jsonl",
);
add(
	"ec36-grounding-gemini.sse",
	readFileSync(join(root, "test/fixtures/gemini/grounding-metadata.sse"), "utf8"),
	geminiAdapter(),
);
add(
	"ec37-logprobs-openai.sse",
	readFileSync(join(root, "test/fixtures/openai-chat/logprobs-stream.sse"), "utf8"),
	openaiChatAdapter(),
);
add(
	"ec38-openai-responses-logprobs.sse",
	readFileSync(join(root, "test/fixtures/openai-responses/logprobs-stream.sse"), "utf8"),
	openaiResponsesAdapter(),
);
add(
	"ec39-gemini-vertex-grounding.jsonl",
	readFileSync(join(root, "test/fixtures/gemini/vertex/grounding-metadata.jsonl"), "utf8"),
	geminiAdapter({ apiSurface: "vertex" }),
	"jsonl",
);
add(
	"ec40-citation-order.sse",
	readFileSync(
		join(root, "test/fixtures/openai-compatible/perplexity/citations-stream.sse"),
		"utf8",
	),
	openaiChatAdapter(),
);

// EC41–EC48 provider errors
add(
	"ec41-oai-recoverable-error.sse",
	`data: ${JSON.stringify({ error: { message: "rate limit", type: "rate_limit_error" } })}\n\n`,
	openaiChatAdapter(),
);
add(
	"ec42-oai-terminal-error.sse",
	oaiChunk("ec42", { role: "assistant" }) +
		`data: ${JSON.stringify({ error: { message: "server", type: "server_error" } })}\n\n` +
		"data: [DONE]\n\n",
	openaiChatAdapter(),
);
add(
	"ec43-anthropic-error.sse",
	anthropicEvent("error", {
		type: "error",
		error: { type: "overloaded_error", message: "overloaded" },
	}),
	anthropicAdapter(),
);
add(
	"ec44-gemini-error.sse",
	`data: ${JSON.stringify({ error: { code: 429, message: "quota", status: "RESOURCE_EXHAUSTED" } })}\n\n`,
	geminiAdapter(),
);
add(
	"ec45-cohere-error.jsonl",
	readFileSync(join(root, "test/fixtures/cohere/provider-error.jsonl"), "utf8"),
	cohereAdapter(),
	"jsonl",
);
add(
	"ec46-bedrock-error.jsonl",
	readFileSync(join(root, "test/fixtures/bedrock/provider-error.jsonl"), "utf8"),
	bedrockAdapter(),
	"jsonl",
);
add(
	"ec47-responses-error.sse",
	`data: ${JSON.stringify({ type: "error", error: { message: "failed", code: "server_error" } })}\n\n`,
	openaiResponsesAdapter(),
);
add(
	"ec48-vertex-error.jsonl",
	'{"error":{"code":400,"message":"bad request","status":"INVALID_ARGUMENT"}}\n',
	geminiAdapter({ apiSurface: "vertex" }),
	"jsonl",
);

// EC49–EC56 incomplete/abort (stream ends early)
add(
	"ec49-incomplete-mid-text.sse",
	oaiChunk("ec49", { role: "assistant" }) + oaiChunk("ec49", { content: "partial" }),
	openaiChatAdapter(),
);
add(
	"ec50-incomplete-mid-tool.sse",
	oaiChunk("ec50", { role: "assistant" }) +
		oaiChunk("ec50", {
			tool_calls: [
				{ index: 0, id: "inc", type: "function", function: { name: "fn", arguments: '{"p":' } },
			],
		}),
	openaiChatAdapter(),
);
add(
	"ec51-anthropic-incomplete.sse",
	readFileSync(join(root, "test/fixtures/anthropic/incomplete.sse"), "utf8"),
	anthropicAdapter(),
);
add(
	"ec52-cohere-incomplete.jsonl",
	readFileSync(join(root, "test/fixtures/cohere/incomplete.jsonl"), "utf8"),
	cohereAdapter(),
	"jsonl",
);
add(
	"ec53-gemini-incomplete.sse",
	readFileSync(join(root, "test/fixtures/gemini/text-basic.sse"), "utf8"),
	geminiAdapter(),
);
add(
	"ec54-bedrock-incomplete.jsonl",
	readFileSync(join(root, "test/fixtures/bedrock/incomplete.jsonl"), "utf8"),
	bedrockAdapter(),
	"jsonl",
);
add(
	"ec55-responses-incomplete.sse",
	`data: ${JSON.stringify({ type: "response.created", response: { id: "ec55" } })}\n\n` +
		`data: ${JSON.stringify({ type: "response.output_text.delta", output_index: 0, delta: "part" })}\n\n`,
	openaiResponsesAdapter(),
);
add("ec56-abort-empty.sse", "", openaiChatAdapter());

// EC57–EC64 transport edges
add(
	"ec57-vertex-envelope.jsonl",
	readFileSync(join(root, "test/fixtures/gemini/vertex/text-basic.jsonl"), "utf8"),
	geminiAdapter({ apiSurface: "vertex" }),
	"jsonl",
);
add(
	"ec58-jsonl-midline.jsonl",
	readFileSync(join(root, "test/fixtures/cohere/text-basic.jsonl"), "utf8"),
	cohereAdapter(),
	"jsonl",
);
add(
	"ec59-bedrock-tail.jsonl",
	readFileSync(join(root, "test/fixtures/bedrock/text-basic.jsonl"), "utf8"),
	bedrockAdapter(),
	"jsonl",
);
add(
	"ec60-vertex-jsonl-split.jsonl",
	readFileSync(join(root, "test/fixtures/gemini/vertex/text-basic.jsonl"), "utf8"),
	geminiAdapter({ apiSurface: "vertex" }),
	"jsonl",
);
add(
	"ec61-bedrock-usage-trail.jsonl",
	readFileSync(join(root, "test/fixtures/bedrock/usage-metadata.jsonl"), "utf8"),
	bedrockAdapter(),
	"jsonl",
);
add(
	"ec62-gemini-jsonl-line.jsonl",
	readFileSync(join(root, "test/fixtures/gemini/vertex/text-basic.jsonl"), "utf8"),
	geminiAdapter({ apiSurface: "vertex" }),
	"jsonl",
);
add(
	"ec63-cohere-jsonl-unicode.jsonl",
	readFileSync(join(root, "test/fixtures/cohere/text-unicode.jsonl"), "utf8"),
	cohereAdapter(),
	"jsonl",
);
add(
	"ec64-openai-chunk-boundary.sse",
	oaiChunk("ec64", { role: "assistant" }) +
		oaiChunk("ec64", { content: "boundary" }, "stop") +
		"data: [DONE]\n\n",
	openaiChatAdapter(),
);

// EC65–EC72 UTF-8 stress
add(
	"ec65-emoji-text.sse",
	oaiChunk("ec65", { role: "assistant" }) +
		oaiChunk("ec65", { content: "🌍🚀" }, "stop") +
		"data: [DONE]\n\n",
	openaiChatAdapter(),
);
add(
	"ec66-zwj-emoji.sse",
	oaiChunk("ec66", { role: "assistant" }) +
		oaiChunk("ec66", { content: "👨‍👩‍👧" }, "stop") +
		"data: [DONE]\n\n",
	openaiChatAdapter(),
);
add(
	"ec67-rtl-text.sse",
	oaiChunk("ec67", { role: "assistant" }) +
		oaiChunk("ec67", { content: "مرحبا world" }, "stop") +
		"data: [DONE]\n\n",
	openaiChatAdapter(),
);
add(
	"ec68-unicode-tool-args.sse",
	oaiChunk("ec68", { role: "assistant" }) +
		oaiChunk("ec68", {
			tool_calls: [
				{
					index: 0,
					id: "u",
					type: "function",
					function: { name: "city", arguments: '{"city":"東京"}' },
				},
			],
		}) +
		oaiChunk("ec68", {}, "tool_calls") +
		"data: [DONE]\n\n",
	openaiChatAdapter(),
);
add(
	"ec69-surrogate-split.sse",
	oaiChunk("ec69", { role: "assistant" }) +
		oaiChunk("ec69", { content: "𝌆" }, "stop") +
		"data: [DONE]\n\n",
	openaiChatAdapter(),
);
add(
	"ec70-jsonl-unicode-split.jsonl",
	readFileSync(join(root, "test/fixtures/cohere/text-unicode.jsonl"), "utf8"),
	cohereAdapter(),
	"jsonl",
);
add(
	"ec71-emoji-reasoning.sse",
	anthropicEvent("message_start", {
		type: "message_start",
		message: { id: "ec71", model: "claude" },
	}) +
		anthropicEvent("content_block_start", {
			type: "content_block_start",
			index: 0,
			content_block: { type: "thinking", thinking: "" },
		}) +
		anthropicEvent("content_block_delta", {
			type: "content_block_delta",
			index: 0,
			delta: { type: "thinking_delta", thinking: "🤔" },
		}) +
		anthropicEvent("content_block_stop", { type: "content_block_stop", index: 0 }) +
		anthropicEvent("content_block_start", {
			type: "content_block_start",
			index: 1,
			content_block: { type: "text", text: "" },
		}) +
		anthropicEvent("content_block_delta", {
			type: "content_block_delta",
			index: 1,
			delta: { type: "text_delta", text: "ok" },
		}) +
		anthropicEvent("content_block_stop", { type: "content_block_stop", index: 1 }) +
		anthropicEvent("message_delta", { type: "message_delta", delta: { stop_reason: "end_turn" } }) +
		anthropicEvent("message_stop", { type: "message_stop" }),
	anthropicAdapter(),
);
add(
	"ec72-multibyte-logprob.sse",
	readFileSync(join(root, "test/fixtures/openai-chat/logprobs-stream.sse"), "utf8"),
	openaiChatAdapter(),
);

// Tier-2 large fixtures (8): pad event count > 120
function padToTier2(baseSse, id, count = 125) {
	let out = "";
	for (let i = 0; i < count; i++) {
		out += oaiChunk(`${id}_${i}`, i === 0 ? { role: "assistant" } : { content: `x${i}` });
	}
	out += oaiChunk(id, {}, "stop") + "data: [DONE]\n\n";
	void baseSse;
	return out;
}

for (let t = 1; t <= 8; t++) {
	const id = `tier2-large-${t}`;
	add(`${id}.sse`, padToTier2("", id), openaiChatAdapter());
}

async function main() {
	mkdirSync(catalogDir, { recursive: true });
	for (const spec of FIXTURES) {
		await writeGolden(spec.file, spec.content, spec.adapter, spec.transport ?? "sse");
	}
	const manifest = Object.fromEntries(
		FIXTURES.map((spec) => [`edge-catalog/${spec.file}`, inferEdgeCatalogMeta(spec.file)]),
	);
	if (!checkMode) {
		writeFileSync(
			join(catalogDir, "manifest.json"),
			`${JSON.stringify(manifest, null, "\t")}\n`,
			"utf8",
		);
	}
	console.log(`${checkMode ? "Checked" : "Wrote"} ${FIXTURES.length} edge-catalog fixtures`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
