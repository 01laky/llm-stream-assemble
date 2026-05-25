import type { AssembleFromFileOptions, StreamAdapter, StreamEvent } from "./types";
import { assembleResponse } from "./assemble-response";
import { assembleStream } from "./assemble-stream";

export function assembleFromFile(
	path: string,
	adapter: StreamAdapter,
	options: AssembleFromFileOptions = {},
): AsyncIterable<StreamEvent> {
	return assembleFromFileGenerator(path, adapter, options);
}

async function* assembleFromFileGenerator(
	path: string,
	adapter: StreamAdapter,
	options: AssembleFromFileOptions,
): AsyncIterable<StreamEvent> {
	const format = options.format ?? inferFormat(path);
	const content = await readFixture(path);

	if (format === "sse") {
		yield* assembleStream(stringIterable(content), adapter, options);
		return;
	}

	let body: unknown;
	try {
		body = JSON.parse(content) as unknown;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(
			`llm-stream-assemble: assembleFromFile failed to parse JSON ${path}: ${message}`,
		);
	}

	for (const event of assembleResponse(body, adapter, options)) {
		yield event;
	}
}

function inferFormat(path: string): "sse" | "json" {
	if (path.endsWith(".sse")) return "sse";
	if (path.endsWith(".json")) return "json";
	throw new Error(`llm-stream-assemble: assembleFromFile cannot infer format for ${path}`);
}

async function readFixture(path: string): Promise<string> {
	try {
		const { readFile } = await import("node:fs/promises");
		return await readFile(path, "utf8");
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`llm-stream-assemble: assembleFromFile failed to read ${path}: ${message}`);
	}
}

async function* stringIterable(value: string): AsyncIterable<string> {
	yield value;
}
