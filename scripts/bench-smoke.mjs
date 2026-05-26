#!/usr/bin/env node
/**
 * Local LSA-C52 smoke benchmark reproduction.
 * Requires: pnpm build (imports from dist/).
 */
/* global TextEncoder, ReadableStream, performance */
import { assembleStream } from "../dist/index.js";

function byteStreamFromStrings(...chunks) {
	const encoder = new TextEncoder();
	return new ReadableStream({
		start(controller) {
			for (const chunk of chunks) {
				controller.enqueue(encoder.encode(chunk));
			}
			controller.close();
		},
	});
}

async function collectAsync(iterable) {
	const items = [];
	for await (const item of iterable) {
		items.push(item);
	}
	return items;
}

const chunks = Array.from({ length: 10_000 }, (_, index) => `data: ${index}\n\n`);
chunks.push("data: [DONE]\n\n");

const started = performance.now();
const events = await collectAsync(
	assembleStream(byteStreamFromStrings(...chunks), {
		parseChunk() {
			return [{ kind: "text-delta", text: "x" }];
		},
	}),
);
const elapsedMs = performance.now() - started;

const textDone = events.at(-2);
const finish = events.at(-1);

console.log("llm-stream-assemble bench-smoke (LSA-C52 scenario)");
console.log(`  node:           ${process.version}`);
console.log(`  elapsed:        ${elapsedMs.toFixed(1)} ms`);
console.log(`  events:         ${events.length}`);
console.log(`  text.done len:  ${textDone?.type === "text.done" ? textDone.text.length : "n/a"}`);
console.log(`  finish:         ${finish?.type === "finish" ? finish.reason : "n/a"}`);

if (events.length !== 10_002) {
	console.error(`FAIL: expected 10002 events, got ${events.length}`);
	process.exit(1);
}

if (textDone?.type !== "text.done" || textDone.text.length !== 10_000) {
	console.error("FAIL: text.done length mismatch");
	process.exit(1);
}

if (finish?.type !== "finish" || finish.reason !== "stop") {
	console.error("FAIL: missing terminal finish");
	process.exit(1);
}
