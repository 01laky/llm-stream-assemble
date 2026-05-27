#!/usr/bin/env node
/* global fetch, TextDecoder */
/**
 * Maintainer-only live smoke for Google AI Gemini streaming.
 * Run: pnpm build && pnpm smoke:gemini [--capture]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { assembleStream, geminiAdapter } from "../../dist/index.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const capture = process.argv.includes("--capture");
const apiKey = process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY;
const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

if (!apiKey) {
	console.error("Set GOOGLE_API_KEY or GEMINI_API_KEY");
	process.exit(1);
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

async function streamPrompt(body, label) {
	console.log(`\n--- ${label} ---`);
	const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;
	const response = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
	if (!response.ok) {
		console.error(`HTTP ${response.status}`);
		process.exit(1);
	}
	if (!response.body) {
		console.error("Empty response body");
		process.exit(1);
	}
	for await (const event of assembleStream(ssePayloads(response.body), geminiAdapter())) {
		types.add(event.type);
		if (!capture) console.log(event.type);
	}
}

await streamPrompt(
	{ contents: [{ role: "user", parts: [{ text: "Reply with one short word." }] }] },
	"text",
);

if (process.env.GEMINI_SMOKE_TOOLS === "1") {
	await streamPrompt(
		{
			contents: [{ role: "user", parts: [{ text: "What is 2+2? Use the calculator tool." }] }],
			tools: [
				{
					functionDeclarations: [
						{
							name: "calculator",
							description: "Evaluate a math expression",
							parameters: {
								type: "OBJECT",
								properties: { expression: { type: "STRING" } },
							},
						},
					],
				},
			],
		},
		"tool (optional)",
	);
}

if (capture) {
	const outDir = join(root, ".local-playground/gemini-capture");
	mkdirSync(outDir, { recursive: true });
	const outPath = join(outDir, `capture-${Date.now()}.txt`);
	writeFileSync(outPath, `${captureLines.join("\n")}\n`, "utf8");
	console.log(`\nWrote capture to ${outPath}`);
	console.log(
		"Maintainer: redact secrets, compare to test/fixtures/gemini/, regenerate expected if drift.",
	);
} else {
	console.log("\nEvent types seen:", [...types].sort().join(", "));
}
