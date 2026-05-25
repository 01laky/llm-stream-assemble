import { assembleFromFile, collectStream, openaiChatAdapter } from "../../src/index";

export interface ReplayFixtureExampleOptions {
	path?: string;
	write?: (text: string) => void;
}

export async function runReplayFixtureExample(
	options: ReplayFixtureExampleOptions = {},
): Promise<void> {
	const path = options.path ?? "test/fixtures/openai-chat/text-basic.sse";
	const write = options.write ?? ((text: string) => process.stdout.write(text));
	const result = await collectStream(assembleFromFile(path, openaiChatAdapter()));
	write(result.text);
	if (result.finishReason) write(`\nFinish: ${result.finishReason.reason}\n`);
}
