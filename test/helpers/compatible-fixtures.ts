import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { OpenAICompatibleAdapterOptions } from "../../src/adapters/openai-compatible";
import {
	HOST_COMPATIBLE_PRESETS,
	type OpenAICompatibleProvider,
} from "../../src/adapters/openai-compatible-presets";
import type { RawChunk, StreamEvent } from "../../src/core/types";

export {
	HOST_COMPATIBLE_PRESETS,
	LOOSE_HOST_PRESETS,
	OPENAI_COMPATIBLE_PROVIDERS,
	STRICT_COMPATIBLE_PRESETS,
} from "../../src/adapters/openai-compatible-presets";

/** @deprecated Use `OPENAI_COMPATIBLE_PROVIDERS` — kept for existing LSA test IDs. */
export { OPENAI_COMPATIBLE_PROVIDERS as ALL_COMPATIBLE_PROVIDERS } from "../../src/adapters/openai-compatible-presets";

export type HostFixtureManifestEntry = {
	kind: "stream" | "response";
	goldenTestId?: string;
	conformanceTestId?: string;
	adapterOptions?: OpenAICompatibleAdapterOptions;
};

export type HostFixtureManifest = Record<string, HostFixtureManifestEntry>;

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "../fixtures/openai-compatible");

export function compatibleTextFixture(name: string, extension: string): string {
	return readFileSync(join(fixturesDir, `${name}.${extension}`), "utf8");
}

export function compatibleJSONFixture(name: string): unknown {
	return JSON.parse(compatibleTextFixture(name, "json")) as unknown;
}

export function expectedCompatibleEvents(name: string): unknown {
	return JSON.parse(compatibleTextFixture(name, "expected.json")) as unknown;
}

function hostFixturePath(
	host: OpenAICompatibleProvider,
	name: string,
	ext: "sse" | "expected.json" | "json",
): string {
	return join(fixturesDir, host, `${name}.${ext}`);
}

export function hostCompatibleFixture(
	host: OpenAICompatibleProvider,
	name: string,
	ext: "sse" | "expected.json" | "json",
): string | unknown {
	const path = hostFixturePath(host, name, ext);
	const raw = readFileSync(path, "utf8");
	if (ext === "json" || ext === "expected.json") {
		return JSON.parse(raw) as unknown;
	}
	return raw;
}

export function expectedHostCompatibleEvents(
	host: OpenAICompatibleProvider,
	name: string,
): unknown {
	return hostCompatibleFixture(host, name, "expected.json");
}

export type HostCompatiblePreset = (typeof HOST_COMPATIBLE_PRESETS)[number];

export function loadHostFixtureManifest(host: OpenAICompatibleProvider): HostFixtureManifest {
	const path = join(fixturesDir, host, "manifest.json");
	if (!existsSync(path)) return {};
	return JSON.parse(readFileSync(path, "utf8")) as HostFixtureManifest;
}

export function listHostStreamFixtures(host: HostCompatiblePreset): string[] {
	const dir = join(fixturesDir, host);
	if (!existsSync(dir)) return [];
	return readdirSync(dir)
		.filter((file) => file.endsWith(".sse"))
		.map((file) => file.slice(0, -4))
		.sort();
}

export function listHostResponseFixtures(host: HostCompatiblePreset): string[] {
	const dir = join(fixturesDir, host);
	if (!existsSync(dir)) return [];
	return readdirSync(dir)
		.filter((file) => file.endsWith(".json") && !file.endsWith(".expected.json"))
		.map((file) => file.slice(0, -5))
		.sort();
}

export function hostFixtureAdapterOptions(
	host: HostCompatiblePreset,
	name: string,
): OpenAICompatibleAdapterOptions {
	const manifest = loadHostFixtureManifest(host);
	return manifest[name]?.adapterOptions ?? (name === "json-mode" ? { jsonMode: true } : {});
}

function stripDefaultChoiceIndex<T extends Record<string, unknown>>(event: T): T {
	if ("choiceIndex" in event && event.choiceIndex === 0) {
		const { choiceIndex: _choiceIndex, ...rest } = event;
		return rest as T;
	}
	return event;
}

export function normalizeCompatibleEvents(events: StreamEvent[]): unknown[] {
	return events.map((event) => {
		if (
			event.type === "metadata" ||
			event.type === "usage" ||
			event.type === "citation" ||
			event.type === "grounding" ||
			event.type === "logprob"
		) {
			const { raw: _raw, ...rest } = event;
			return stripDefaultChoiceIndex(rest);
		}
		if (event.type === "error") {
			return { type: "error", recoverable: event.recoverable };
		}
		return stripDefaultChoiceIndex(event as Record<string, unknown>);
	});
}

export function normalizeCompatibleRawChunks(chunks: RawChunk[]): unknown[] {
	return chunks.map((chunk) => {
		if (
			chunk.kind === "metadata" ||
			chunk.kind === "usage" ||
			chunk.kind === "citation" ||
			chunk.kind === "grounding" ||
			chunk.kind === "logprob"
		) {
			const { raw: _raw, ...rest } = chunk;
			return rest;
		}
		if (chunk.kind === "provider-error") {
			return { kind: "provider-error", recoverable: chunk.recoverable };
		}
		return chunk;
	});
}
