import { assembleStream, geminiAdapter } from "../../src/index";

export interface GeminiExampleOptions {
	apiKey?: string;
	model?: string;
	fetchImpl?: typeof fetch;
	write?: (text: string) => void;
}

export async function runGeminiExample(options: GeminiExampleOptions = {}): Promise<void> {
	const apiKey = options.apiKey ?? process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY;
	if (!apiKey) throw new Error("GOOGLE_API_KEY or GEMINI_API_KEY is required");

	const fetchImpl = options.fetchImpl ?? fetch;
	const write = options.write ?? ((text: string) => process.stdout.write(text));
	const model = options.model ?? "gemini-2.5-flash";

	const url = new URL(
		`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent`,
	);
	url.searchParams.set("alt", "sse");
	url.searchParams.set("key", apiKey);

	const response = await fetchImpl(url.toString(), {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			contents: [{ parts: [{ text: "Say hello in one short sentence." }] }],
		}),
	});

	if (!response.body) throw new Error("Gemini response body is empty");

	for await (const event of assembleStream(response.body, geminiAdapter())) {
		if (event.type === "text.delta") write(event.text);
		if (event.type === "reasoning.delta") write(`[reasoning] ${event.text}`);
		if (event.type === "tool_call.done") write(`\nTool call: ${event.name}\n`);
		if (event.type === "finish") write(`\nFinish: ${event.reason}\n`);
	}
}
