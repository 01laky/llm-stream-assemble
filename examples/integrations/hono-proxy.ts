import type { StreamEvent } from "../../src/core/types";
import {
	handleLLMProxyRequest,
	type ProxyExampleOptions,
} from "../proxy-safety/web-standard-proxy";

export type HonoProxyOptions = ProxyExampleOptions;

/** Thin wrapper — Hono passes `c.req.raw` (Web `Request`) directly. */
export const handleHonoLLMProxy = handleLLMProxyRequest;

export interface HonoProxyExampleOptions extends ProxyExampleOptions {
	write?: (text: string) => void;
}

export async function runHonoProxyExample(options: HonoProxyExampleOptions = {}): Promise<void> {
	const write = options.write ?? ((text: string) => process.stdout.write(text));
	const request = new Request("https://example.test/proxy", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ prompt: "Say hello in one short sentence.", stream: true }),
	});
	const response = await handleHonoLLMProxy(request, options);
	const text = await response.text();
	write(text);
}

export function logHonoProxyEvent(event: StreamEvent): void {
	if (event.type === "text.delta") process.stdout.write(event.text);
}
