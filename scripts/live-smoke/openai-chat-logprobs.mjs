#!/usr/bin/env node
/* global fetch, TextDecoder */
/**
 * Maintainer-only live smoke for OpenAI Chat Completions with logprobs.
 * Run: pnpm build && pnpm smoke:openai-logprobs [--capture]
 * Skips (exit 0) when OPENAI_API_KEY is unset.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { assembleStream, openaiChatAdapter } from "../../dist/index.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const capture = process.argv.includes("--capture");
const apiKey = process.env.OPENAI_API_KEY;
const model = process.env.OPENAI_LOGPROBS_MODEL ?? "gpt-4o-mini";

if (!apiKey) {
	console.warn("OPENAI_API_KEY not set — skipping openai-logprobs smoke");
	process.exit(0);
}

const types = new Set();
const captureLines = [];

async function* ssePayloads(body) {
	const reader = body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });
		const lines = buffer.split("\n");
		buffer = lines.pop() ?? "";
		for (const line of lines) {
			const trimmed = line.trim();
			if (!trimmed.startsWith("data:")) continue;
			const payload = trimmed.slice(5).trim();
			if (payload.length === 0 || payload === "[DONE]") continue;
			if (capture) captureLines.push(payload);
			yield payload;
		}
	}
	const tail = buffer.trim();
	if (tail.startsWith("data:")) {
		const payload = tail.slice(5).trim();
		if (payload.length > 0 && payload !== "[DONE]") {
			if (capture) captureLines.push(payload);
			yield payload;
		}
	}
}

console.log(`\n--- OpenAI Chat logprobs (${model}) ---`);

const response = await fetch("https://api.openai.com/v1/chat/completions", {
	method: "POST",
	headers: {
		Authorization: `Bearer ${apiKey}`,
		"Content-Type": "application/json",
	},
	body: JSON.stringify({
		model,
		messages: [{ role: "user", content: "Reply with one short word." }],
		stream: true,
		logprobs: true,
		top_logprobs: 3,
	}),
});

if (!response.ok) {
	console.error(`HTTP ${response.status}`);
	process.exit(1);
}
if (!response.body) {
	console.error("Empty response body");
	process.exit(1);
}

for await (const event of assembleStream(ssePayloads(response.body), openaiChatAdapter())) {
	types.add(event.type);
	if (!capture) console.log(event.type);
}

if (!types.has("text.delta")) {
	console.error("Expected at least one text.delta event");
	process.exit(1);
}

if (!types.has("logprob")) {
	console.warn("Warning: no logprob events — model may omit logprobs on this endpoint");
}

if (capture) {
	const outDir = join(root, ".local-playground/openai-logprobs-capture");
	mkdirSync(outDir, { recursive: true });
	const outPath = join(outDir, `capture-${Date.now()}.txt`);
	writeFileSync(outPath, `${captureLines.join("\n")}\n`, "utf8");
	console.log(`\nWrote capture to ${outPath}`);
	console.log(
		"Maintainer: redact secrets, compare to test/fixtures/openai-chat/logprobs-*, regenerate expected if drift.",
	);
} else {
	console.log("\nEvent types seen:", [...types].sort().join(", "));
}
