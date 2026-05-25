import { anthropicAdapter, assembleStream } from "../../src/index";

export interface AnthropicExampleOptions {
	apiKey?: string;
	model?: string;
	fetchImpl?: typeof fetch;
	write?: (text: string) => void;
}

export async function runAnthropicExample(options: AnthropicExampleOptions = {}): Promise<void> {
	const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY;
	if (!apiKey) throw new Error("ANTHROPIC_API_KEY is required");

	const fetchImpl = options.fetchImpl ?? fetch;
	const write = options.write ?? ((text: string) => process.stdout.write(text));
	const response = await fetchImpl("https://api.anthropic.com/v1/messages", {
		method: "POST",
		headers: {
			"x-api-key": apiKey,
			"anthropic-version": "2023-06-01",
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			model: options.model ?? "claude-3-5-sonnet-latest",
			messages: [{ role: "user", content: "Say hello in one short sentence." }],
			max_tokens: 128,
			stream: true,
		}),
	});

	if (!response.body) throw new Error("Anthropic response body is empty");

	for await (const event of assembleStream(response.body, anthropicAdapter())) {
		if (event.type === "text.delta") write(event.text);
		if (event.type === "reasoning.delta") write(`[reasoning] ${event.text}`);
		if (event.type === "tool_call.done") write(`\nTool call: ${event.name}\n`);
		if (event.type === "finish") write(`\nFinish: ${event.reason}\n`);
	}
}
