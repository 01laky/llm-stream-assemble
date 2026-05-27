import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { geminiAdapter } from "../../src/adapters/gemini";
import { assembleFromPayloads } from "../../src/core/assemble-payloads";
import type { StreamEvent } from "../../src/core/types";
import { collectAsync } from "./collect-events";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "../fixtures/gemini");
const vertexFixturesDir = join(fixturesDir, "vertex");

export function geminiTextFixture(name: string, extension: string): string {
	return readFileSync(join(fixturesDir, `${name}.${extension}`), "utf8");
}

export function vertexTextFixture(name: string, extension: string): string {
	return readFileSync(join(vertexFixturesDir, `${name}.${extension}`), "utf8");
}

export function geminiJSONFixture(name: string): unknown {
	return JSON.parse(geminiTextFixture(name, "json")) as unknown;
}

export function vertexJSONFixture(name: string): unknown {
	return JSON.parse(vertexTextFixture(name, "json")) as unknown;
}

export function expectedGeminiEvents(name: string): unknown {
	return JSON.parse(geminiTextFixture(name, "expected.json")) as unknown;
}

export function expectedVertexEvents(name: string): unknown {
	return JSON.parse(vertexTextFixture(name, "expected.json")) as unknown;
}

export function vertexJsonlLines(name: string): string[] {
	return vertexTextFixture(name, "jsonl")
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.length > 0);
}

export function normalizeGeminiEvents(events: StreamEvent[]): unknown[] {
	return events.map((event) => {
		if (event.type === "metadata") {
			const { raw: _raw, ...rest } = event;
			return rest;
		}
		if (event.type === "usage") {
			const { raw: _raw, ...rest } = event;
			return rest;
		}
		if (event.type === "error") {
			return { type: "error", recoverable: event.recoverable };
		}
		return event;
	});
}

export async function assembleVertexJsonl(
	name: string,
	options: { jsonMode?: boolean } = {},
): Promise<StreamEvent[]> {
	async function* payloads() {
		for (const line of vertexJsonlLines(name)) yield line;
	}
	return collectAsync(
		assembleFromPayloads(payloads(), geminiAdapter({ apiSurface: "vertex", ...options })),
	);
}

export function writeVertexExpected(name: string, events: StreamEvent[]): void {
	writeFileSync(
		join(vertexFixturesDir, `${name}.expected.json`),
		`${JSON.stringify(normalizeGeminiEvents(events), null, "\t")}\n`,
		"utf8",
	);
}
