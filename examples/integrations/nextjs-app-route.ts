import {
	handleLLMProxyRequest,
	type ProxyExampleOptions,
} from "../proxy-safety/web-standard-proxy";

/**
 * Next.js App Router Route Handler pattern — works on Node and Edge when using Web APIs.
 * `assembleFromFile` is Node-only; this handler uses streaming fetch only.
 */
export type NextAppRouteOptions = ProxyExampleOptions;

export async function handleNextAppRoutePost(
	request: Request,
	options: NextAppRouteOptions = {},
): Promise<Response> {
	return handleLLMProxyRequest(request, options);
}

export interface NextAppRouteExampleOptions extends NextAppRouteOptions {
	write?: (text: string) => void;
}

export async function runNextAppRouteExample(
	options: NextAppRouteExampleOptions = {},
): Promise<void> {
	const write = options.write ?? ((text: string) => process.stdout.write(text));
	const request = new Request("https://app.example/api/chat", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ prompt: "hi", stream: true }),
	});
	const response = await handleNextAppRoutePost(request, options);
	write(await response.text());
}
