import { readFileSync } from "node:fs";
import type { StreamAdapter } from "../../src/core/types";
import {
	assembleFromFile,
	assembleFromPayloads,
	collectStream,
	openaiChatAdapter,
} from "../../src/index";

/** Replay any adapter fixture, e.g. `test/fixtures/gemini/text-basic.sse` with `geminiAdapter()`. */
export interface ReplayFixtureExampleOptions {
	path?: string;
	adapter?: StreamAdapter;
	write?: (text: string) => void;
}

export async function runReplayFixtureExample(
	options: ReplayFixtureExampleOptions = {},
): Promise<void> {
	const path = options.path ?? "test/fixtures/openai-chat/text-basic.sse";
	const adapter = options.adapter ?? openaiChatAdapter();
	const write = options.write ?? ((text: string) => process.stdout.write(text));

	let result;
	if (path.endsWith(".jsonl")) {
		const lines = readFileSync(path, "utf8")
			.split("\n")
			.map((line) => line.trim())
			.filter((line) => line.length > 0);
		async function* payloads() {
			for (const line of lines) yield line;
		}
		async function* events() {
			yield* assembleFromPayloads(payloads(), adapter);
		}
		result = await collectStream(events());
	} else {
		result = await collectStream(assembleFromFile(path, adapter));
	}

	write(result.text);
	if (result.finishReason) write(`\nFinish: ${result.finishReason.reason}\n`);
}
