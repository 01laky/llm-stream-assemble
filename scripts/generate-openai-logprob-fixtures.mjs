#!/usr/bin/env node
/**
 * Generate or check logprob fixture expected.json files for OpenAI Chat + compatible.
 * Usage: node scripts/generate-openai-logprob-fixtures.mjs [--check]
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { ReadableStream } from "node:stream/web";
import { TextEncoder } from "node:util";
import { fileURLToPath } from "node:url";
import { openaiChatAdapter } from "../dist/adapters/openai-chat.js";
import { openaiCompatibleAdapter } from "../dist/adapters/openai-compatible.js";
import { assembleStream, assembleResponse } from "../dist/index.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const check = process.argv.includes("--check");

function normalize(events) {
	return events.map((event) => {
		if (
			event.type === "metadata" ||
			event.type === "usage" ||
			event.type === "citation" ||
			event.type === "grounding" ||
			event.type === "logprob"
		) {
			const { raw, ...rest } = event;
			void raw;
			if ("choiceIndex" in rest && rest.choiceIndex === 0) {
				const { choiceIndex, ...withoutChoice } = rest;
				void choiceIndex;
				return withoutChoice;
			}
			return rest;
		}
		if (event.type === "error") {
			return { type: "error", recoverable: event.recoverable };
		}
		if ("choiceIndex" in event && event.choiceIndex === 0) {
			const { choiceIndex, ...rest } = event;
			void choiceIndex;
			return rest;
		}
		return event;
	});
}

async function streamEvents(sse, adapter) {
	const events = [];
	for await (const event of assembleStream(
		new ReadableStream({
			start(controller) {
				controller.enqueue(new TextEncoder().encode(sse));
				controller.close();
			},
		}),
		adapter,
	)) {
		events.push(event);
	}
	return normalize(events);
}

function responseEvents(body, adapter) {
	return normalize(assembleResponse(body, adapter));
}

const streamFixtures = [
	{
		dir: "openai-chat",
		name: "logprobs-stream",
		adapter: () => openaiChatAdapter(),
	},
	{
		dir: "openai-chat",
		name: "logprobs-multichoice",
		adapter: () => openaiChatAdapter(),
	},
	{
		dir: "openai-chat",
		name: "logprobs-refusal",
		adapter: () => openaiChatAdapter(),
	},
	{
		dir: "openai-chat",
		name: "logprobs-tool-stream",
		adapter: () => openaiChatAdapter(),
	},
	{
		dir: "openai-chat",
		name: "logprobs-json-mode",
		adapter: () => openaiChatAdapter({ jsonMode: true }),
	},
	{
		dir: "openai-compatible",
		name: "logprobs-stream",
		adapter: () => openaiCompatibleAdapter(),
	},
	{
		dir: "openai-compatible/groq",
		name: "logprobs-stream",
		adapter: () => openaiCompatibleAdapter({ provider: "groq" }),
	},
];

const responseFixtures = [
	{
		dir: "openai-chat",
		name: "logprobs-response",
		adapter: () => openaiChatAdapter(),
	},
];

let failed = false;

for (const fixture of streamFixtures) {
	const base = join(root, "test/fixtures", fixture.dir, fixture.name);
	const sse = readFileSync(`${base}.sse`, "utf8");
	const expected = await streamEvents(sse, fixture.adapter());
	const expectedPath = `${base}.expected.json`;
	const next = `${JSON.stringify(expected, null, "\t")}\n`;
	if (check) {
		if (!existsSync(expectedPath) || readFileSync(expectedPath, "utf8") !== next) {
			console.error(`Mismatch: ${expectedPath}`);
			failed = true;
		}
		continue;
	}
	writeFileSync(expectedPath, next);
	console.log(`Wrote ${expectedPath}`);
}

for (const fixture of responseFixtures) {
	const base = join(root, "test/fixtures", fixture.dir, fixture.name);
	const body = JSON.parse(readFileSync(`${base}.json`, "utf8"));
	const expected = responseEvents(body, fixture.adapter());
	const expectedPath = `${base}.expected.json`;
	const next = `${JSON.stringify(expected, null, "\t")}\n`;
	if (check) {
		if (!existsSync(expectedPath) || readFileSync(expectedPath, "utf8") !== next) {
			console.error(`Mismatch: ${expectedPath}`);
			failed = true;
		}
		continue;
	}
	writeFileSync(expectedPath, next);
	console.log(`Wrote ${expectedPath}`);
}

if (failed) process.exit(1);
