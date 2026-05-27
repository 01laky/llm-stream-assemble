import { readFileSync } from "node:fs";
import type { StreamAdapter } from "../../src/core/types";
import { assembleFromPayloads } from "../../src/core/assemble-payloads";
import { assembleStream } from "../../src/core/assemble-stream";
import { byteStreamFromStrings, collectAsync } from "./collect-events";

export interface AdapterGoldenOptions {
	adapter: StreamAdapter;
	fixtureSsePath: string;
	expectedEventsPath: string;
	adapterFactory?: () => StreamAdapter;
}

export async function runAdapterGoldenStream(options: AdapterGoldenOptions): Promise<unknown[]> {
	const sse = readFileSync(options.fixtureSsePath, "utf8");
	const adapter = options.adapterFactory?.() ?? options.adapter;
	const events = await collectAsync(assembleStream(byteStreamFromStrings(sse), adapter));
	return events;
}

export interface AdapterGoldenPayloadsOptions {
	adapter: StreamAdapter;
	lines: string[];
	expectedEventsPath: string;
	adapterFactory?: () => StreamAdapter;
}

export async function runAdapterGoldenPayloads(
	options: AdapterGoldenPayloadsOptions,
): Promise<unknown[]> {
	const adapter = options.adapterFactory?.() ?? options.adapter;
	async function* payloads() {
		for (const line of options.lines) yield line;
	}
	return collectAsync(assembleFromPayloads(payloads(), adapter));
}

export function readExpectedEvents(path: string): unknown {
	return JSON.parse(readFileSync(path, "utf8")) as unknown;
}
