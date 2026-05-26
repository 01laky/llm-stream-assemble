import { createAssemblyTransform, openaiChatAdapter, toSSE } from "../../src/index";

/** Pipe upstream bytes through a Web TransformStream at the framework boundary. */
export interface AssemblyTransformPipelineOptions {
	fetchImpl?: typeof fetch;
	apiKey?: string;
	upstreamUrl?: string;
}

export async function runAssemblyTransformPipelineExample(
	options: AssemblyTransformPipelineOptions = {},
): Promise<Response> {
	const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
	if (!apiKey) throw new Error("OPENAI_API_KEY is required");

	const fetchImpl = options.fetchImpl ?? fetch;
	const upstreamUrl = options.upstreamUrl ?? "https://api.openai.com/v1/chat/completions";
	const upstream = await fetchImpl(upstreamUrl, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			model: "gpt-4o-mini",
			messages: [{ role: "user", content: "Say hello in one short sentence." }],
			stream: true,
		}),
	});

	if (!upstream.body) throw new Error("Upstream response body is empty");

	const transform = createAssemblyTransform(openaiChatAdapter());
	const eventStream = upstream.body.pipeThrough(transform);
	return new Response(toSSE(eventStream, { sanitizeErrors: true }), {
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
		},
	});
}

export interface AssemblyTransformExampleOptions extends AssemblyTransformPipelineOptions {
	write?: (text: string) => void;
}

export async function runAssemblyTransformExample(
	options: AssemblyTransformExampleOptions = {},
): Promise<void> {
	const write = options.write ?? ((text: string) => process.stdout.write(text));
	const response = await runAssemblyTransformPipelineExample(options);
	write(await response.text());
}
