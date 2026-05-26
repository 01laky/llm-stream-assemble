/**
 * One-off maintainer script: writes test/fixtures/gemini/*.expected.json from *.sse / *.json.
 * Run: pnpm build && node scripts/generate-gemini-fixtures.mjs
 */
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { ReadableStream } from "node:stream/web";
import { TextEncoder } from "node:util";
import { fileURLToPath } from "node:url";
import { geminiAdapter } from "../dist/adapters/gemini.js";
import { assembleStream } from "../dist/core/index.js";
import { assembleResponse } from "../dist/index.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "test/fixtures/gemini");
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

function normalize(events) {
	return events.map((event) => {
		if (event.type === "metadata" || event.type === "usage") {
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

async function collectStreamEvents(sse, options) {
	const events = [];
	for await (const event of assembleStream(
		new ReadableStream({
			start(c) {
				c.enqueue(new TextEncoder().encode(sse));
				c.close();
			},
		}),
		geminiAdapter(options),
	)) {
		events.push(event);
	}
	return normalize(events);
}

const streamFixtures = {
	"text-basic": `data: {"responseId":"resp_text","modelVersion":"gemini-2.5-flash","candidates":[{"index":0,"content":{"role":"model","parts":[{"text":"Hello"}]}}]}

data: {"candidates":[{"index":0,"content":{"role":"model","parts":[{"text":" Gemini"}]}}]}

data: {"candidates":[{"index":0,"finishReason":"STOP","content":{"role":"model","parts":[]}}],"usageMetadata":{"promptTokenCount":5,"candidatesTokenCount":2,"totalTokenCount":7}}

`,
	"text-unicode": `data: {"responseId":"resp_uni","modelVersion":"gemini-2.5-flash","candidates":[{"index":0,"content":{"role":"model","parts":[{"text":"Hello 🌍 你好"}]}}]}

data: {"candidates":[{"index":0,"finishReason":"STOP","content":{"role":"model","parts":[]}}]}

`,
	"text-empty-parts": `data: {"responseId":"resp_empty","candidates":[{"index":0,"content":{"role":"model","parts":[{"text":""},{"text":"   "},{"text":"ok"}]}}]}

data: {"candidates":[{"index":0,"finishReason":"STOP","content":{"role":"model","parts":[]}}]}

`,
	"tool-single": `data: {"responseId":"resp_tool","candidates":[{"index":0,"content":{"role":"model","parts":[{"functionCall":{"name":"get_weather","id":"call_1"}}]}}]}

data: {"candidates":[{"index":0,"content":{"role":"model","parts":[{"functionCall":{"name":"get_weather","id":"call_1","args":{"city":"Bo"}}}]}}]}

data: {"candidates":[{"index":0,"content":{"role":"model","parts":[{"functionCall":{"name":"get_weather","id":"call_1","args":{"city":"Boston","unit":"C"}}}]}}],"finishReason":"STOP"}

`,
	"tool-parallel": `data: {"responseId":"resp_par","candidates":[{"index":0,"content":{"role":"model","parts":[{"functionCall":{"name":"search","id":"call_a","args":{"q":"a"}}},{"functionCall":{"name":"search","id":"call_b","args":{"q":"b"}}}]}}],"finishReason":"STOP"}

`,
	"tool-args-object": `data: {"responseId":"resp_args","candidates":[{"index":0,"content":{"role":"model","parts":[{"functionCall":{"name":"merge","id":"call_m","args":{"a":1}}}]}}]}

data: {"candidates":[{"index":0,"content":{"role":"model","parts":[{"functionCall":{"name":"merge","id":"call_m","args":{"a":1,"b":2}}}]}}],"finishReason":"STOP"}

`,
	"tool-partial-args": `data: {"responseId":"resp_part","candidates":[{"index":0,"content":{"role":"model","parts":[{"functionCall":{"name":"controlLight","partialArgs":[{"jsonPath":"$.brightness","numberValue":50}],"willContinue":true}}]}}]}

data: {"candidates":[{"index":0,"content":{"role":"model","parts":[{"functionCall":{"name":"controlLight","partialArgs":[{"jsonPath":"$.brightness","stringValue":"%"}],"willContinue":false}}]}}],"finishReason":"STOP"}

`,
	"tool-name-before-args": `data: {"responseId":"resp_nba","candidates":[{"index":0,"content":{"role":"model","parts":[{"functionCall":{"name":"lookup","id":"call_nba"}}]}}]}

data: {"candidates":[{"index":0,"content":{"role":"model","parts":[{"functionCall":{"id":"call_nba","args":{"id":42}}}]}}],"finishReason":"STOP"}

`,
	"tool-flush-without-terminal": `data: {"responseId":"resp_flush","candidates":[{"index":0,"content":{"role":"model","parts":[{"functionCall":{"name":"save","id":"call_f","partialArgs":[{"jsonPath":"$.payload","stringValue":"{\\"ok\\":true"}],"willContinue":true}}]}}]}

data: {"candidates":[{"index":0,"finishReason":"STOP","content":{"role":"model","parts":[]}}]}

`,
	"json-mode": `data: {"responseId":"resp_json","candidates":[{"index":0,"content":{"role":"model","parts":[{"text":"{\\"ok\\":true}"}]}}],"finishReason":"STOP"}

`,
	thinking: `data: {"responseId":"resp_think","candidates":[{"index":0,"content":{"role":"model","parts":[{"thought":true,"text":"Let me think"}]}}]}

data: {"candidates":[{"index":0,"content":{"role":"model","parts":[{"text":"Answer"}]}}],"finishReason":"STOP"}

`,
	"usage-only": `data: {"usageMetadata":{"promptTokenCount":3,"candidatesTokenCount":0,"totalTokenCount":3}}

`,
	"metadata-early": `data: {"responseId":"resp_meta","modelVersion":"gemini-2.5-flash","candidates":[{"index":0,"content":{"role":"model","parts":[{"text":"Hi"}]}}]}

data: {"candidates":[{"index":0,"finishReason":"STOP","content":{"role":"model","parts":[]}}]}

`,
	"finish-max-tokens": `data: {"responseId":"resp_len","candidates":[{"index":0,"content":{"role":"model","parts":[{"text":"truncated"}]}}],"finishReason":"MAX_TOKENS"}

`,
	"finish-safety": `data: {"responseId":"resp_safe","candidates":[{"index":0,"finishReason":"SAFETY","content":{"role":"model","parts":[]}}]}

`,
	"prompt-blocked": `data: {"promptFeedback":{"blockReason":"SAFETY"},"usageMetadata":{"promptTokenCount":1,"totalTokenCount":1}}

`,
	"provider-error": `data: {"error":{"code":400,"message":"Invalid request","status":"INVALID_ARGUMENT"}}

`,
	incomplete: `data: {"responseId":"resp_inc","candidates":[{"index":0,"content":{"role":"model","parts":[{"text":"partial"}]}}]}

`,
	"empty-candidates": `data: {"responseId":"resp_ec","candidates":[]}

data: {"candidates":[{"index":0,"content":{"role":"model","parts":[{"text":"after"}]}}],"finishReason":"STOP"}

`,
};

const responseFixtures = {
	"response-text": {
		responseId: "resp_rt",
		modelVersion: "gemini-2.5-flash",
		candidates: [
			{
				index: 0,
				content: { role: "model", parts: [{ text: "Hello Gemini" }] },
				finishReason: "STOP",
			},
		],
		usageMetadata: { promptTokenCount: 4, candidatesTokenCount: 2, totalTokenCount: 6 },
	},
	"response-tool": {
		responseId: "resp_rtool",
		candidates: [
			{
				index: 0,
				content: {
					role: "model",
					parts: [
						{
							functionCall: {
								name: "get_weather",
								id: "call_rt",
								args: { city: "Boston" },
							},
						},
					],
				},
				finishReason: "STOP",
			},
		],
	},
	"response-blocked": {
		promptFeedback: { blockReason: "SAFETY" },
	},
	"response-error": {
		error: { code: 403, message: "Forbidden", status: "PERMISSION_DENIED" },
	},
};

for (const [name, sse] of Object.entries(streamFixtures)) {
	writeFileSync(join(dir, `${name}.sse`), sse, "utf8");
	const options = name === "json-mode" ? { jsonMode: true } : undefined;
	const events = await collectStreamEvents(sse, options);
	writeFileSync(join(dir, `${name}.expected.json`), `${JSON.stringify(events, null, 2)}\n`, "utf8");
	console.log(`stream ${name}: ${events.length} events`);
}

for (const [name, body] of Object.entries(responseFixtures)) {
	writeFileSync(join(dir, `${name}.json`), `${JSON.stringify(body, null, 2)}\n`, "utf8");
	const events = normalize(assembleResponse(body, geminiAdapter()));
	writeFileSync(join(dir, `${name}.expected.json`), `${JSON.stringify(events, null, 2)}\n`, "utf8");
	console.log(`response ${name}: ${events.length} events`);
}
