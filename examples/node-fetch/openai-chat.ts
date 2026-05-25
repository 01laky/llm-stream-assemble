import { assembleStream, matchEvent, openaiChatAdapter } from "../../src/index";

export interface OpenAIChatExampleOptions {
	apiKey?: string;
	model?: string;
	fetchImpl?: typeof fetch;
	write?: (text: string) => void;
}

export async function runOpenAIChatExample(options: OpenAIChatExampleOptions = {}): Promise<void> {
	const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
	if (!apiKey) throw new Error("OPENAI_API_KEY is required");

	const fetchImpl = options.fetchImpl ?? fetch;
	const write = options.write ?? ((text: string) => process.stdout.write(text));
	const response = await fetchImpl("https://api.openai.com/v1/chat/completions", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			model: options.model ?? "gpt-4o-mini",
			messages: [{ role: "user", content: "Say hello in one short sentence." }],
			stream: true,
			stream_options: { include_usage: true },
		}),
	});

	if (!response.body) throw new Error("OpenAI response body is empty");

	for await (const event of assembleStream(response.body, openaiChatAdapter())) {
		matchEvent(event, {
			"text.delta": (textEvent) => write(textEvent.text),
			"tool_call.done": (toolEvent) => write(`\nTool call: ${toolEvent.name}\n`),
			usage: (usageEvent) => write(`\nUsage: ${JSON.stringify(usageEvent)}\n`),
			finish: (finishEvent) => write(`\nFinish: ${finishEvent.reason}\n`),
		});
	}
}
