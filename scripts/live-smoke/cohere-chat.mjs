/* global fetch, TextDecoder */
/**
 * Maintainer-only live smoke for Cohere Chat v2 SSE.
 * Run: pnpm build && pnpm smoke:cohere
 *
 * Optional: --capture writes one JSON event per line to stdout (fixture bootstrap).
 * Optional: COHERE_SMOKE_TOOLS=1 enables a single-tool request.
 */
import { assembleFromPayloads } from "../../dist/index.js";
import { cohereAdapter } from "../../dist/adapters/cohere.js";

const apiKey = process.env.COHERE_API_KEY;
const model = process.env.COHERE_MODEL ?? "command-r-plus-08-2024";
const capture = process.argv.includes("--capture");
const toolsEnabled = process.env.COHERE_SMOKE_TOOLS === "1";

async function* ssePayloads(body) {
	const reader = body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });
		const lines = buffer.split("\n");
		buffer = lines.pop() ?? "";
		for (const line of lines) {
			const trimmed = line.trim();
			if (!trimmed.startsWith("data:")) continue;
			const payload = trimmed.slice(5).trim();
			if (payload.length === 0 || payload === "[DONE]") continue;
			if (capture) process.stdout.write(`${payload}\n`);
			yield payload;
		}
	}
	const tail = buffer.trim();
	if (tail.startsWith("data:")) {
		const payload = tail.slice(5).trim();
		if (payload.length > 0 && payload !== "[DONE]") {
			if (capture) process.stdout.write(`${payload}\n`);
			yield payload;
		}
	}
}

async function main() {
	if (!apiKey) {
		console.error("COHERE_API_KEY is required");
		process.exit(1);
	}

	const body = {
		model,
		messages: [{ role: "user", content: "Reply with one short word." }],
		stream: true,
		...(toolsEnabled
			? {
					tools: [
						{
							type: "function",
							function: {
								name: "get_weather",
								description: "Get weather",
								parameters: {
									type: "object",
									properties: { city: { type: "string" } },
									required: ["city"],
								},
							},
						},
					],
				}
			: {}),
	};

	let response;
	try {
		response = await fetch("https://api.cohere.com/v2/chat", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(body),
		});
	} catch (error) {
		console.warn(`Cohere unreachable — skipping smoke (${String(error)})`);
		process.exit(0);
	}

	if (!response.ok || !response.body) {
		console.warn(`Cohere HTTP ${response.status} — skipping smoke`);
		process.exit(0);
	}

	const types = new Set();
	for await (const unified of assembleFromPayloads(ssePayloads(response.body), cohereAdapter())) {
		types.add(unified.type);
		if (!capture) console.log(unified.type);
	}

	if (
		!capture &&
		!types.has("text.delta") &&
		!types.has("finish") &&
		!types.has("tool_call.start")
	) {
		console.error("Expected text.delta, tool_call.start, or finish events");
		process.exit(1);
	}

	if (!capture) {
		console.log("\nEvent types seen:", [...types].sort().join(", "));
	}
}

await main();
