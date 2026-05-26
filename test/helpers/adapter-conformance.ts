import { readFileSync } from "node:fs";
import type { StreamAdapter } from "../../src/core/types";
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

export function readExpectedEvents(path: string): unknown {
	return JSON.parse(readFileSync(path, "utf8")) as unknown;
}
