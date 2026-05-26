import { assembleFromFile, collectStream, openaiChatAdapter } from "../../src/index";

/** Node-only — materialize a stream for non-streaming HTTP handlers or mapper tests. */
export interface CollectStreamHandlerOptions {
	fixturePath?: string;
	write?: (text: string) => void;
}

export async function runCollectStreamHandlerExample(
	options: CollectStreamHandlerOptions = {},
): Promise<{ text: string; finishReason?: string }> {
	const path = options.fixturePath ?? "test/fixtures/openai-chat/text-basic.sse";
	const write = options.write ?? ((text: string) => process.stdout.write(text));
	const collected = await collectStream(assembleFromFile(path, openaiChatAdapter()));
	write(collected.text);
	if (collected.finishReason) {
		write(`\nFinish: ${collected.finishReason.reason}\n`);
	}
	return {
		text: collected.text,
		finishReason: collected.finishReason?.reason,
	};
}
