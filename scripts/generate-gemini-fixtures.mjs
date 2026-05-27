/**
 * Maintainer script: writes gemini fixture expected.json files from sources.
 * Run: npm run build && npm run fixtures:generate-gemini
 * Check: npm run fixtures:check-gemini
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { ReadableStream } from "node:stream/web";
import { TextEncoder } from "node:util";
import { fileURLToPath } from "node:url";
import { geminiAdapter } from "../dist/adapters/gemini.js";
import { assembleStream, assembleFromPayloads } from "../dist/core/index.js";
import { assembleResponse } from "../dist/index.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const googleDir = join(root, "test/fixtures/gemini");
const vertexDir = join(googleDir, "vertex");
const checkMode = process.argv.includes("--check");
const surfaceArg = process.argv.find((a) => a.startsWith("--surface="));
const surfaceFilter = surfaceArg?.split("=")[1];

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

async function collectPayloadEvents(lines, options) {
	async function* payloads() {
		for (const line of lines) yield line;
	}
	const events = [];
	for await (const event of assembleFromPayloads(payloads(), geminiAdapter(options))) {
		events.push(event);
	}
	return normalize(events);
}

function sseToJsonlLines(sse) {
	return sse
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.startsWith("data:"))
		.map((line) => line.slice(5).trim())
		.filter((line) => line.length > 0 && line !== "[DONE]");
}

function writeExpected(dir, name, events) {
	const path = join(dir, `${name}.expected.json`);
	const next = `${JSON.stringify(events, null, "\t")}\n`;
	if (checkMode) {
		if (!existsSync(path)) {
			console.error(`missing ${path}`);
			process.exitCode = 1;
			return;
		}
		const current = readFileSync(path, "utf8");
		if (current !== next) {
			console.error(`drift ${path}`);
			process.exitCode = 1;
			return;
		}
		console.log(`unchanged ${name}`);
		return;
	}
	writeFileSync(path, next, "utf8");
	console.log(`${name}: ${events.length} events`);
}

async function processGoogleAi() {
	if (surfaceFilter && surfaceFilter !== "google-ai") return;

	const sseNames = readdirSync(googleDir)
		.filter((f) => f.endsWith(".sse"))
		.map((f) => f.replace(/\.sse$/, ""));

	for (const name of sseNames) {
		const ssePath = join(googleDir, `${name}.sse`);
		if (!existsSync(ssePath)) continue;
		const sse = readFileSync(ssePath, "utf8");
		const options = name === "json-mode" ? { jsonMode: true } : undefined;
		const events = await collectStreamEvents(sse, options);
		writeExpected(googleDir, name, events);
	}

	const jsonNames = readdirSync(googleDir)
		.filter((f) => f.endsWith(".json") && !f.endsWith(".expected.json"))
		.map((f) => f.replace(/\.json$/, ""));

	for (const name of jsonNames) {
		if (name === "README") continue;
		const body = JSON.parse(readFileSync(join(googleDir, `${name}.json`), "utf8"));
		const events = normalize(assembleResponse(body, geminiAdapter()));
		writeExpected(googleDir, name, events);
	}
}

async function processVertex() {
	if (surfaceFilter && surfaceFilter !== "vertex") return;

	if (!checkMode) {
		mkdirSync(vertexDir, { recursive: true });
	}

	const sseNames = readdirSync(googleDir)
		.filter((f) => f.endsWith(".sse"))
		.map((f) => f.replace(/\.sse$/, ""));

	for (const name of sseNames) {
		const sse = readFileSync(join(googleDir, `${name}.sse`), "utf8");
		const lines = sseToJsonlLines(sse);
		if (!checkMode) {
			writeFileSync(join(vertexDir, `${name}.jsonl`), `${lines.join("\n")}\n`, "utf8");
		}
		const options =
			name === "json-mode" ? { apiSurface: "vertex", jsonMode: true } : { apiSurface: "vertex" };
		const events = await collectPayloadEvents(lines, options);
		writeExpected(vertexDir, name, events);
	}

	// envelope-wrapped: wrap each inner line
	if (existsSync(join(vertexDir, "text-basic.jsonl")) || !checkMode) {
		const basicLines = sseToJsonlLines(readFileSync(join(googleDir, "text-basic.sse"), "utf8"));
		const wrapped = basicLines.map((line) => JSON.stringify({ response: JSON.parse(line) }));
		if (!checkMode) {
			writeFileSync(join(vertexDir, "envelope-wrapped.jsonl"), `${wrapped.join("\n")}\n`, "utf8");
		}
		const events = await collectPayloadEvents(wrapped, { apiSurface: "vertex" });
		writeExpected(vertexDir, "envelope-wrapped", events);
	}

	// envelope-tuned-endpoint: result wrapper
	if (!checkMode || existsSync(join(vertexDir, "envelope-tuned-endpoint.jsonl"))) {
		const basicLines = sseToJsonlLines(readFileSync(join(googleDir, "text-basic.sse"), "utf8"));
		const wrapped = basicLines.map((line) => JSON.stringify({ result: JSON.parse(line) }));
		if (!checkMode) {
			writeFileSync(
				join(vertexDir, "envelope-tuned-endpoint.jsonl"),
				`${wrapped.join("\n")}\n`,
				"utf8",
			);
		}
		const events = await collectPayloadEvents(wrapped, { apiSurface: "vertex" });
		writeExpected(vertexDir, "envelope-tuned-endpoint", events);
	}

	// grounding fixtures
	const groundingLine = JSON.stringify({
		responseId: "resp_ground",
		candidates: [
			{
				index: 0,
				groundingMetadata: {
					webSearchQueries: ["weather Boston"],
					groundingChunks: [{ web: { uri: "https://example.com", title: "Example" } }],
				},
				content: { role: "model", parts: [{ text: "Grounded answer" }] },
				finishReason: "STOP",
			},
		],
	});
	const groundingChunksLine = JSON.stringify({
		candidates: [
			{
				index: 0,
				groundingMetadata: {
					groundingSupports: [{ segment: { startIndex: 0, endIndex: 4, text: "Ground" } }],
				},
				content: { role: "model", parts: [{ text: "Ground" }] },
				finishReason: "STOP",
			},
		],
	});
	for (const [name, line] of [
		["grounding-metadata", groundingLine],
		["grounding-chunks", groundingChunksLine],
	]) {
		if (!checkMode) {
			writeFileSync(join(vertexDir, `${name}.jsonl`), `${line}\n`, "utf8");
		}
		const events = await collectPayloadEvents([line], { apiSurface: "vertex" });
		writeExpected(vertexDir, name, events);
	}

	// unknown envelope → metadata.raw forward compat
	const unknownLine = JSON.stringify({ vertexTraceId: "trace-1", status: "OK" });
	if (!checkMode) {
		writeFileSync(join(vertexDir, "unknown-envelope.jsonl"), `${unknownLine}\n`, "utf8");
	}
	const unknownEvents = await collectPayloadEvents([unknownLine], { apiSurface: "vertex" });
	writeExpected(vertexDir, "unknown-envelope", unknownEvents);

	// response json mirrors
	for (const name of ["response-text", "response-tool", "response-error", "response-blocked"]) {
		const src = join(googleDir, `${name}.json`);
		if (!existsSync(src)) continue;
		if (!checkMode) {
			writeFileSync(join(vertexDir, `${name}.json`), readFileSync(src, "utf8"), "utf8");
		}
		const body = JSON.parse(readFileSync(join(vertexDir, `${name}.json`), "utf8"));
		const events = normalize(assembleResponse(body, geminiAdapter({ apiSurface: "vertex" })));
		writeExpected(vertexDir, name, events);
	}
}

await processGoogleAi();
await processVertex();

if (checkMode && process.exitCode !== 1) {
	console.log("OK: gemini fixtures unchanged");
}
