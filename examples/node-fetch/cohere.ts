import { assembleFromPayloads, assembleStream, cohereAdapter } from "../../src/index";

export interface CohereExampleOptions {
	apiKey?: string;
	model?: string;
	fetchImpl?: typeof fetch;
	/** Pre-decoded SSE jsonl lines for offline tests */
	eventLines?: string[];
	write?: (text: string) => void;
	tools?: boolean;
}

export async function runCohereExample(options: CohereExampleOptions = {}): Promise<void> {
	const write = options.write ?? ((text: string) => process.stdout.write(text));
	const eventLines = options.eventLines;

	if (eventLines && eventLines.length > 0) {
		async function* payloads() {
			for (const line of eventLines) yield line;
		}
		for await (const event of assembleFromPayloads(payloads(), cohereAdapter())) {
			if (event.type === "text.delta") write(event.text);
			if (event.type === "reasoning.delta") write(`[plan] ${event.text}`);
			if (event.type === "tool_call.done") write(`\nTool: ${event.name}\n`);
			if (event.type === "finish") write(`\nFinish: ${event.reason}\n`);
		}
		return;
	}

	const apiKey = options.apiKey ?? process.env.COHERE_API_KEY;
	if (!apiKey) throw new Error("COHERE_API_KEY is required");

	const fetchImpl = options.fetchImpl ?? fetch;
	const model = options.model ?? process.env.COHERE_MODEL ?? "command-r-plus-08-2024";

	const body: Record<string, unknown> = {
		model,
		messages: [{ role: "user", content: "Say hello in one short sentence." }],
		stream: true,
	};

	if (options.tools) {
		body.tools = [
			{
				type: "function",
				function: {
					name: "get_weather",
					description: "Get weather for a city",
					parameters: {
						type: "object",
						properties: { city: { type: "string" } },
						required: ["city"],
					},
				},
			},
		];
	}

	const response = await fetchImpl("https://api.cohere.com/v2/chat", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(body),
	});

	if (!response.body) throw new Error("Cohere response body is empty");

	for await (const event of assembleStream(response.body, cohereAdapter())) {
		if (event.type === "text.delta") write(event.text);
		if (event.type === "reasoning.delta") write(`[plan] ${event.text}`);
		if (event.type === "tool_call.done") write(`\nTool: ${event.name}\n`);
		if (event.type === "finish") write(`\nFinish: ${event.reason}\n`);
	}
}
