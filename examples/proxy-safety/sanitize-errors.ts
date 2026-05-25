import { toSSE, type StreamEvent } from "../../src/index";

export async function sanitizedErrorSSEExample(): Promise<string> {
	const events = (async function* (): AsyncIterable<StreamEvent> {
		yield {
			type: "error",
			error: new Error("Upstream failed with Bearer sk-secret1234567890"),
			recoverable: false,
			sanitized: "The upstream provider returned an error.",
		};
		yield { type: "finish", reason: "error" };
	})();

	const response = new Response(toSSE(events, { sanitizeErrors: true }));
	return response.text();
}
