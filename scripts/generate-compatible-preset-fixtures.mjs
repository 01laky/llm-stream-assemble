/**
 * Maintainer script: writes or checks test/fixtures/openai-compatible/<host>/*.expected.json
 *
 * Usage:
 *   pnpm build && node scripts/generate-compatible-preset-fixtures.mjs
 *   node scripts/generate-compatible-preset-fixtures.mjs --host groq --name text-basic
 *   node scripts/generate-compatible-preset-fixtures.mjs --check
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { ReadableStream } from "node:stream/web";
import { TextEncoder } from "node:util";
import { fileURLToPath } from "node:url";
import {
	HOST_COMPATIBLE_PRESETS,
	openaiCompatibleAdapter,
} from "../dist/adapters/openai-compatible.js";
import { assembleStream } from "../dist/core/index.js";
import { assembleResponse } from "../dist/index.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const fixturesRoot = join(root, "test/fixtures/openai-compatible");

const HOSTS = HOST_COMPATIBLE_PRESETS;

function loadManifest(host) {
	const path = join(fixturesRoot, host, "manifest.json");
	if (!existsSync(path)) return {};
	return JSON.parse(readFileSync(path, "utf8"));
}

function parseArgs(argv) {
	const args = { check: false, host: undefined, name: undefined, kind: undefined };
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === "--check") args.check = true;
		else if (arg === "--host") args.host = argv[++i];
		else if (arg === "--name") args.name = argv[++i];
		else if (arg === "--kind") args.kind = argv[++i];
		else if (arg === "--help" || arg === "-h") {
			console.log(`Usage:
  node scripts/generate-compatible-preset-fixtures.mjs [--check]
  node scripts/generate-compatible-preset-fixtures.mjs --host groq --name text-basic
  node scripts/generate-compatible-preset-fixtures.mjs --host deepseek --name response-basic --kind response

Options:
  --check   Regenerate all host expected files in memory and fail if any differ from disk
  --host    Host preset folder (groq, deepseek, …)
  --name    Fixture base name without extension
  --kind    "response" for .json input; default is stream (.sse)`);
			process.exit(0);
		}
	}
	return args;
}

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
		if ("choiceIndex" in event && event.choiceIndex === 0) {
			const { choiceIndex, ...rest } = event;
			void choiceIndex;
			return rest;
		}
		return event;
	});
}

async function collectStreamEvents(sse, host, options = {}) {
	const events = [];
	for await (const event of assembleStream(
		new ReadableStream({
			start(c) {
				c.enqueue(new TextEncoder().encode(sse));
				c.close();
			},
		}),
		openaiCompatibleAdapter({ provider: host, ...options }),
	)) {
		events.push(event);
	}
	return normalize(events);
}

function collectResponseEvents(body, host) {
	return normalize(assembleResponse(body, openaiCompatibleAdapter({ provider: host })));
}

function discoverFixtures(hostFilter, nameFilter) {
	const entries = [];
	const hosts = hostFilter ? [hostFilter] : HOSTS;
	for (const host of hosts) {
		const dir = join(fixturesRoot, host);
		if (!existsSync(dir)) continue;
		for (const file of readdirSync(dir)) {
			if (file.endsWith(".sse")) {
				const name = file.slice(0, -4);
				if (nameFilter && name !== nameFilter) continue;
				entries.push({ host, name, kind: "stream" });
			} else if (
				file.endsWith(".json") &&
				!file.endsWith(".expected.json") &&
				file !== "manifest.json"
			) {
				const name = file.slice(0, -5);
				if (nameFilter && name !== nameFilter) continue;
				entries.push({ host, name, kind: "response" });
			}
		}
	}
	return entries;
}

async function generateEntry(entry, options = {}) {
	const { host, name, kind } = entry;
	const dir = join(fixturesRoot, host);
	const expectedPath = join(dir, `${name}.expected.json`);
	let events;
	if (kind === "response") {
		const body = JSON.parse(readFileSync(join(dir, `${name}.json`), "utf8"));
		events = collectResponseEvents(body, host);
	} else {
		const sse = readFileSync(join(dir, `${name}.sse`), "utf8");
		const manifest = loadManifest(host);
		const adapterOptions =
			manifest[name]?.adapterOptions ?? (name === "json-mode" ? { jsonMode: true } : {});
		events = await collectStreamEvents(sse, host, adapterOptions);
	}
	const serialized = `${JSON.stringify(events, null, 2)}\n`;
	if (options.check) {
		const existing = readFileSync(expectedPath, "utf8");
		const existingParsed = JSON.parse(existing);
		const generatedParsed = JSON.parse(serialized);
		if (JSON.stringify(existingParsed) !== JSON.stringify(generatedParsed)) {
			throw new Error(`drift: ${host}/${name}.expected.json differs from adapter output`);
		}
		console.log(`unchanged ${host}/${name}`);
		return { changed: false };
	}
	writeFileSync(expectedPath, serialized, "utf8");
	console.log(`${options.check ? "checked" : "wrote"} ${host}/${name}: ${events.length} events`);
	return { changed: true };
}

const args = parseArgs(process.argv.slice(2));

if (args.host && args.name) {
	const entries = discoverFixtures(args.host, args.name);
	const entry = entries.find((e) => e.name === args.name) ?? {
		host: args.host,
		name: args.name,
		kind: args.kind === "response" ? "response" : "stream",
	};
	await generateEntry(entry, { check: args.check });
	process.exit(0);
}

const entries = discoverFixtures();
let failures = 0;
for (const entry of entries) {
	try {
		await generateEntry(entry, { check: args.check });
	} catch (error) {
		failures++;
		console.error(String(error instanceof Error ? error.message : error));
	}
}

if (failures > 0) {
	console.error(`${failures} fixture(s) failed ${args.check ? "check" : "generation"}`);
	process.exit(1);
}

console.log(`${entries.length} host fixture(s) ${args.check ? "unchanged" : "generated"}`);
