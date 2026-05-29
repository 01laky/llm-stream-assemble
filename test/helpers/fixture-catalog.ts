import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import type { StreamAdapter } from "../../src/core/types";
import { anthropicAdapter } from "../../src/adapters/anthropic";
import { bedrockAdapter } from "../../src/adapters/bedrock";
import { cohereAdapter } from "../../src/adapters/cohere";
import { geminiAdapter } from "../../src/adapters/gemini";
import { openaiChatAdapter } from "../../src/adapters/openai-chat";
import { openaiCompatibleAdapter } from "../../src/adapters/openai-compatible";
import { openaiResponsesAdapter } from "../../src/adapters/openai-responses";
import { hostFixtureAdapterOptions } from "./compatible-fixtures";
import { evilOffsetChunkSizes } from "./byte-stream";

const fixturesRoot = join(dirname(fileURLToPath(import.meta.url)), "../fixtures");

export const EVIL_OFFSET_SAMPLE_IDS = [
	"openai-chat/text-basic.sse",
	"openai-responses/text-basic.sse",
	"anthropic/text-basic.sse",
	"gemini/text-basic.sse",
	"gemini/vertex/text-basic.jsonl",
	"cohere/text-basic.jsonl",
	"bedrock/text-basic.jsonl",
	"openai-compatible/generic-text.sse",
	"openai-compatible/groq/text-basic.sse",
	"openai-compatible/azure/content-filter-block.sse",
] as const;

function needsJsonMode(baseName: string): boolean {
	return (
		baseName.includes("json-mode") ||
		baseName === "response-format-json" ||
		baseName.includes("logprobs-json-mode")
	);
}

export type FixtureTransport = "sse" | "jsonl";

export interface FixtureCatalogEntry {
	id: string;
	adapterKey: string;
	streamPath: string;
	expectedPath: string;
	format: FixtureTransport;
	transport: FixtureTransport;
	tier: 1 | 2 | 3;
	adapterOptions?: Record<string, unknown>;
	evilOffsetSample?: boolean;
}

const CHUNK_MATRIX_EXCLUSIONS = new Set([
	// Stream golden predates jsonMode line-stream mapping; covered by LSA-CO79/CO24.
	"cohere/response-format-json.jsonl",
]);

let edgeCatalogManifest:
	| Record<
			string,
			{ adapterKey: string; adapterOptions?: Record<string, unknown>; transport?: FixtureTransport }
	  >
	| undefined;
let cachedEdgeCatalogFixtures: FixtureCatalogEntry[] | undefined;

function loadEdgeCatalogManifest(): typeof edgeCatalogManifest {
	if (edgeCatalogManifest !== undefined) return edgeCatalogManifest;
	const manifestPath = join(fixturesRoot, "edge-catalog/manifest.json");
	if (!existsSync(manifestPath)) {
		edgeCatalogManifest = {};
		return edgeCatalogManifest;
	}
	edgeCatalogManifest = JSON.parse(readFileSync(manifestPath, "utf8")) as NonNullable<
		typeof edgeCatalogManifest
	>;
	for (const id of Object.keys(edgeCatalogManifest)) {
		CHUNK_MATRIX_EXCLUSIONS.add(id);
	}
	return edgeCatalogManifest;
}

export function discoverEdgeCatalogFixtures(): FixtureCatalogEntry[] {
	if (!cachedEdgeCatalogFixtures) {
		const manifest = loadEdgeCatalogManifest();
		const entries: FixtureCatalogEntry[] = [];
		for (const [id, meta] of Object.entries(manifest)) {
			const streamPath = join(fixturesRoot, id);
			const transport = meta.transport ?? streamExtension(id);
			if (!transport || !existsSync(streamPath)) continue;
			const expectedPath = streamPath.replace(/\.(sse|jsonl)$/, ".expected.json");
			if (!existsSync(expectedPath)) continue;
			const raw = readFileSync(streamPath, "utf8");
			entries.push({
				id,
				adapterKey: meta.adapterKey,
				streamPath,
				expectedPath,
				format: transport,
				transport,
				tier: assignTier(raw, transport, id),
				adapterOptions: meta.adapterOptions,
			});
		}
		cachedEdgeCatalogFixtures = entries.sort((a, b) => a.id.localeCompare(b.id));
	}
	return cachedEdgeCatalogFixtures;
}

const TIER3_IDS = new Set(["transforms/malformed.sse", "bedrock/event-stream-bytes.jsonl"]);

function isExcludedStreamFile(name: string, dir: string): boolean {
	if (name.endsWith(".expected.json")) return true;
	if (name === "README.md" || name === "manifest.json" || name === "invalid.json") return true;
	if (name.endsWith(".bin")) return true;
	if (dir.includes("/transforms/") && name !== "malformed.sse") return true;
	return false;
}

function streamExtension(name: string): FixtureTransport | null {
	if (name.endsWith(".sse")) return "sse";
	if (name.endsWith(".jsonl")) return "jsonl";
	return null;
}

function countLogicalEvents(raw: string, transport: FixtureTransport): number {
	if (transport === "jsonl") {
		return raw.split("\n").filter((line) => line.trim().length > 0).length;
	}
	return raw.split("\n\n").filter((block) => block.trim().length > 0).length;
}

function resolveAdapterMeta(
	id: string,
	baseName: string,
): { adapterKey: string; adapterOptions?: Record<string, unknown> } {
	const edgeMeta = loadEdgeCatalogManifest()[id];
	if (edgeMeta) {
		return { adapterKey: edgeMeta.adapterKey, adapterOptions: edgeMeta.adapterOptions };
	}
	if (id.startsWith("openai-chat/")) {
		return {
			adapterKey: "openai-chat",
			adapterOptions: needsJsonMode(baseName) ? { jsonMode: true } : undefined,
		};
	}
	if (id.startsWith("openai-responses/")) {
		return {
			adapterKey: "openai-responses",
			adapterOptions: needsJsonMode(baseName) ? { jsonMode: true } : undefined,
		};
	}
	if (id.startsWith("anthropic/")) {
		return {
			adapterKey: "anthropic",
			adapterOptions: needsJsonMode(baseName) ? { jsonMode: true } : undefined,
		};
	}
	if (id.startsWith("gemini/vertex/")) {
		return {
			adapterKey: "gemini-vertex",
			adapterOptions: {
				apiSurface: "vertex",
				...(needsJsonMode(baseName) ? { jsonMode: true } : {}),
			},
		};
	}
	if (id.startsWith("gemini/")) {
		return {
			adapterKey: "gemini",
			adapterOptions: needsJsonMode(baseName) ? { jsonMode: true } : undefined,
		};
	}
	if (id.startsWith("cohere/")) {
		return {
			adapterKey: "cohere",
			adapterOptions: needsJsonMode(baseName) ? { jsonMode: true } : undefined,
		};
	}
	if (id.startsWith("bedrock/")) {
		const options: Record<string, unknown> = {};
		if (baseName.startsWith("nova-")) options.modelFamily = "nova";
		if (needsJsonMode(baseName)) options.jsonMode = true;
		return {
			adapterKey: "bedrock",
			adapterOptions: Object.keys(options).length ? options : undefined,
		};
	}
	if (id.startsWith("openai-compatible/")) {
		const parts = id.split("/");
		const jsonOptions = needsJsonMode(baseName) ? { jsonMode: true } : {};
		if (parts.length === 2) {
			return {
				adapterKey: "openai-compatible",
				adapterOptions: Object.keys(jsonOptions).length ? jsonOptions : {},
			};
		}
		const host = parts[1];
		const manifestOptions = hostFixtureAdapterOptions(host, baseName);
		return {
			adapterKey: `openai-compatible/${host}`,
			adapterOptions: { provider: host, ...manifestOptions, ...jsonOptions },
		};
	}
	return { adapterKey: "unknown" };
}

function assignTier(raw: string, transport: FixtureTransport, id: string): 1 | 2 | 3 {
	if (TIER3_IDS.has(id)) return 3;
	const bytes = Buffer.byteLength(raw, "utf8");
	const events = countLogicalEvents(raw, transport);
	if (bytes > 32 * 1024 || events > 120) return 2;
	return 1;
}

function walkFixtures(dir: string, entries: FixtureCatalogEntry[]): void {
	for (const name of readdirSync(dir)) {
		const fullPath = join(dir, name);
		const relDir = relative(fixturesRoot, dir).replace(/\\/g, "/");
		if (statSync(fullPath).isDirectory()) {
			if (name === "core") continue;
			walkFixtures(fullPath, entries);
			continue;
		}
		if (isExcludedStreamFile(name, relDir)) continue;
		const ext = streamExtension(name);
		if (!ext) continue;
		const baseName = basename(name, `.${ext}`);
		const id = relDir ? `${relDir}/${baseName}.${ext}` : `${baseName}.${ext}`;
		const expectedPath = join(dir, `${baseName}.expected.json`);
		if (!existsSync(expectedPath)) {
			if (TIER3_IDS.has(id)) {
				entries.push({
					id,
					adapterKey: resolveAdapterMeta(id, baseName).adapterKey,
					streamPath: fullPath,
					expectedPath: expectedPath,
					format: ext,
					transport: ext,
					tier: 3,
					adapterOptions: resolveAdapterMeta(id, baseName).adapterOptions,
				});
			}
			continue;
		}
		if (CHUNK_MATRIX_EXCLUSIONS.has(id)) continue;
		const raw = readFileSync(fullPath, "utf8");
		const meta = resolveAdapterMeta(id, baseName);
		entries.push({
			id,
			adapterKey: meta.adapterKey,
			streamPath: fullPath,
			expectedPath,
			format: ext,
			transport: ext,
			tier: assignTier(raw, ext, id),
			adapterOptions: meta.adapterOptions,
			evilOffsetSample: (EVIL_OFFSET_SAMPLE_IDS as readonly string[]).includes(id),
		});
	}
}

let cachedStreamFixtures: FixtureCatalogEntry[] | undefined;

export function discoverStreamFixtures(): FixtureCatalogEntry[] {
	if (!cachedStreamFixtures) {
		const entries: FixtureCatalogEntry[] = [];
		walkFixtures(fixturesRoot, entries);
		cachedStreamFixtures = entries.sort((a, b) => a.id.localeCompare(b.id));
	}
	return cachedStreamFixtures;
}

export interface ResponseFixtureEntry {
	id: string;
	adapterKey: string;
	responsePath: string;
	expectedPath: string;
	adapterOptions?: Record<string, unknown>;
}

function walkResponseFixtures(dir: string, entries: ResponseFixtureEntry[]): void {
	for (const name of readdirSync(dir)) {
		const fullPath = join(dir, name);
		const relDir = relative(fixturesRoot, dir).replace(/\\/g, "/");
		if (statSync(fullPath).isDirectory()) {
			if (name === "core" || name === "transforms") continue;
			walkResponseFixtures(fullPath, entries);
			continue;
		}
		if (!name.startsWith("response-") || !name.endsWith(".json")) continue;
		if (name.endsWith(".expected.json")) continue;
		const baseName = basename(name, ".json");
		const id = relDir ? `${relDir}/${baseName}` : baseName;
		const expectedPath = join(dir, `${baseName}.expected.json`);
		if (!existsSync(expectedPath)) continue;
		const meta = resolveAdapterMeta(
			id.replace(/\/response-/, "/"),
			baseName.replace(/^response-/, ""),
		);
		entries.push({
			id,
			adapterKey: meta.adapterKey,
			responsePath: fullPath,
			expectedPath,
			adapterOptions: meta.adapterOptions,
		});
	}
}

let cachedResponseFixtures: ResponseFixtureEntry[] | undefined;

export function discoverResponseFixtures(): ResponseFixtureEntry[] {
	if (!cachedResponseFixtures) {
		const entries: ResponseFixtureEntry[] = [];
		walkResponseFixtures(fixturesRoot, entries);
		cachedResponseFixtures = entries.sort((a, b) => a.id.localeCompare(b.id));
	}
	return cachedResponseFixtures;
}

export function createAdapterForEntry(
	entry: FixtureCatalogEntry | ResponseFixtureEntry,
): StreamAdapter {
	const options = entry.adapterOptions ?? {};
	switch (entry.adapterKey) {
		case "openai-chat":
			return openaiChatAdapter(options as Parameters<typeof openaiChatAdapter>[0]);
		case "openai-responses":
			return openaiResponsesAdapter(options as Parameters<typeof openaiResponsesAdapter>[0]);
		case "anthropic":
			return anthropicAdapter(options as Parameters<typeof anthropicAdapter>[0]);
		case "gemini":
			return geminiAdapter(options as Parameters<typeof geminiAdapter>[0]);
		case "gemini-vertex":
			return geminiAdapter(options as Parameters<typeof geminiAdapter>[0]);
		case "cohere":
			return cohereAdapter(options as Parameters<typeof cohereAdapter>[0]);
		case "bedrock":
			return bedrockAdapter(options as Parameters<typeof bedrockAdapter>[0]);
		default:
			if (entry.adapterKey.startsWith("openai-compatible")) {
				return openaiCompatibleAdapter(options as Parameters<typeof openaiCompatibleAdapter>[0]);
			}
			throw new Error(`Unknown adapterKey: ${entry.adapterKey}`);
	}
}

export const TIER1_CHUNK_SIZES = [1, 3, 7, 17, 31, 64] as const;
export const TIER2_CHUNK_SIZES = [1, 17, 64] as const;

export function chunkSizesForEntry(
	entry: FixtureCatalogEntry,
	includeEvilOffsets: boolean,
): number[] {
	const sizes = new Set<number>();
	const raw = readFileSync(entry.streamPath, "utf8");
	const byteLen = Buffer.byteLength(raw, "utf8");
	if (entry.tier === 1) {
		for (const size of TIER1_CHUNK_SIZES) sizes.add(size);
		if (includeEvilOffsets && entry.evilOffsetSample) {
			for (const size of evilOffsetChunkSizes(byteLen)) sizes.add(size);
		}
	} else if (entry.tier === 2) {
		for (const size of TIER2_CHUNK_SIZES) sizes.add(size);
	} else {
		sizes.add(1);
		sizes.add(0);
	}
	return [...sizes].sort((a, b) => a - b);
}

export function evilOffsetSizesForEntry(entry: FixtureCatalogEntry): number[] {
	const raw = readFileSync(entry.streamPath, "utf8");
	return evilOffsetChunkSizes(Buffer.byteLength(raw, "utf8"));
}

export function tier1FixtureCount(): number {
	return discoverStreamFixtures().filter((entry) => entry.tier === 1).length;
}
