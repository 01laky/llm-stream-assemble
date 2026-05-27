#!/usr/bin/env node
/**
 * Generate or check logprob fixture expected.json files for OpenAI Responses API.
 * Usage: node scripts/generate-openai-responses-logprob-fixtures.mjs [--check]
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { ReadableStream } from "node:stream/web";
import { TextEncoder } from "node:util";
import { fileURLToPath } from "node:url";
import { openaiResponsesAdapter } from "../dist/adapters/openai-responses.js";
import { assembleStream, assembleResponse } from "../dist/index.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const fixturesDir = join(root, "test/fixtures/openai-responses");
const check = process.argv.includes("--check");

function normalize(events) {
	return events.map((event) => {
		if (event.type === "metadata" || event.type === "usage" || event.type === "logprob") {
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
	{ name: "logprobs-stream", adapter: () => openaiResponsesAdapter() },
	{ name: "logprobs-done-batch", adapter: () => openaiResponsesAdapter() },
	{ name: "logprobs-json-mode", adapter: () => openaiResponsesAdapter({ jsonMode: true }) },
	{ name: "logprobs-refusal", adapter: () => openaiResponsesAdapter() },
	{ name: "logprobs-tool-stream", adapter: () => openaiResponsesAdapter() },
	{ name: "logprobs-multi-output", adapter: () => openaiResponsesAdapter() },
	{ name: "logprobs-failed-stream", adapter: () => openaiResponsesAdapter() },
	{ name: "logprobs-content-part-added", adapter: () => openaiResponsesAdapter() },
];

const responseFixtures = [
	{ name: "logprobs-response", adapter: () => openaiResponsesAdapter() },
	{ name: "logprobs-refusal-response", adapter: () => openaiResponsesAdapter() },
];

let failed = false;

for (const fixture of streamFixtures) {
	const base = join(fixturesDir, fixture.name);
	const sse = readFileSync(`${base}.sse`, "utf8");
	const expected = await streamEvents(sse, fixture.adapter());
	const expectedPath = `${base}.expected.json`;
	const serialized = `${JSON.stringify(expected, null, "\t")}\n`;
	if (check) {
		if (!existsSync(expectedPath)) {
			console.error(`Missing ${expectedPath}`);
			failed = true;
			continue;
		}
		const existing = readFileSync(expectedPath, "utf8");
		if (existing !== serialized) {
			console.error(`Drift: ${expectedPath}`);
			failed = true;
		}
	} else {
		writeFileSync(expectedPath, serialized, "utf8");
		console.log(`Wrote ${expectedPath}`);
	}
}

for (const fixture of responseFixtures) {
	const base = join(fixturesDir, fixture.name);
	const body = JSON.parse(readFileSync(`${base}.json`, "utf8"));
	const expected = responseEvents(body, fixture.adapter());
	const expectedPath = `${base}.expected.json`;
	const serialized = `${JSON.stringify(expected, null, "\t")}\n`;
	if (check) {
		if (!existsSync(expectedPath)) {
			console.error(`Missing ${expectedPath}`);
			failed = true;
			continue;
		}
		const existing = readFileSync(expectedPath, "utf8");
		if (existing !== serialized) {
			console.error(`Drift: ${expectedPath}`);
			failed = true;
		}
	} else {
		writeFileSync(expectedPath, serialized, "utf8");
		console.log(`Wrote ${expectedPath}`);
	}
}

if (failed) process.exit(1);
