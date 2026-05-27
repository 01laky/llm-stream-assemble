import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cohereAdapter } from "../../src/adapters/cohere";
import { assembleFromPayloads } from "../../src/core/assemble-payloads";
import { assembleResponse } from "../../src/core/assemble-response";
import { assembleStream } from "../../src/core/assemble-stream";
import type { StreamEvent } from "../../src/core/types";
import { byteStreamFromStrings, collectAsync } from "./collect-events";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "../fixtures/cohere");

export function cohereTextFixture(name: string, extension: string): string {
	return readFileSync(join(fixturesDir, `${name}.${extension}`), "utf8");
}

export function cohereJsonlLines(name: string): string[] {
	return cohereTextFixture(name, "jsonl")
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.length > 0);
}

export function cohereJSONFixture(name: string): unknown {
	return JSON.parse(cohereTextFixture(name, "json")) as unknown;
}

export function expectedCohereEvents(name: string): unknown {
	return JSON.parse(cohereTextFixture(name, "expected.json")) as unknown;
}

export function normalizeCohereEvents(events: StreamEvent[]): unknown[] {
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
		if (event.type === "tool_call.args.delta") {
			const { partial: _partial, ...rest } = event;
			return rest;
		}
		return event;
	});
}

export async function assembleCohereJsonl(
	name: string,
	options: Parameters<typeof cohereAdapter>[0] = {},
): Promise<unknown[]> {
	async function* payloads() {
		for (const line of cohereJsonlLines(name)) yield line;
	}
	return normalizeCohereEvents(
		await collectAsync(assembleFromPayloads(payloads(), cohereAdapter(options))),
	);
}

export async function assembleCohereSse(
	name: string,
	options: Parameters<typeof cohereAdapter>[0] = {},
): Promise<unknown[]> {
	return normalizeCohereEvents(
		await collectAsync(
			assembleStream(byteStreamFromStrings(cohereTextFixture(name, "sse")), cohereAdapter(options)),
		),
	);
}

export function assembleCohereResponse(
	name: string,
	options: Parameters<typeof cohereAdapter>[0] = {},
): unknown[] {
	return normalizeCohereEvents(assembleResponse(cohereJSONFixture(name), cohereAdapter(options)));
}

/** Dev helper — regenerate golden expected.json from current adapter behavior. */
export async function writeExpectedFromJsonl(name: string, jsonMode = false): Promise<void> {
	const events = await assembleCohereJsonl(name, jsonMode ? { jsonMode: true } : {});
	writeFileSync(
		join(fixturesDir, `${name}.expected.json`),
		`${JSON.stringify(events, null, "\t")}\n`,
	);
}

export async function writeExpectedFromResponse(name: string, jsonMode = false): Promise<void> {
	const events = assembleCohereResponse(name, jsonMode ? { jsonMode: true } : {});
	writeFileSync(
		join(fixturesDir, `${name}.expected.json`),
		`${JSON.stringify(events, null, "\t")}\n`,
	);
}

export function jsonlToSse(name: string): void {
	const lines = cohereJsonlLines(name);
	const sse = lines.map((line) => `data: ${line}\n\n`).join("");
	writeFileSync(join(fixturesDir, `${name}.sse`), sse);
}
