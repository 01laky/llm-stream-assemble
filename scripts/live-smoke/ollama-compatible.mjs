/**
 * Maintainer-only live smoke for Ollama OpenAI-compatible streaming.
 * Run: pnpm build && pnpm smoke:ollama
 */
/* global fetch */
import { assembleStream, openaiCompatibleAdapter } from "../../dist/index.js";

const baseUrl = (process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/v1").replace(/\/$/, "");
const model = process.env.OLLAMA_MODEL ?? "llama3.2";

async function main() {
	let response;
	try {
		response = await fetch(`${baseUrl}/chat/completions`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				model,
				messages: [{ role: "user", content: "Reply with one short word." }],
				stream: true,
			}),
		});
	} catch (error) {
		console.warn(`Ollama unreachable at ${baseUrl} — skipping smoke (${String(error)})`);
		process.exit(0);
	}

	if (!response.ok) {
		console.error(`HTTP ${response.status}`);
		process.exit(1);
	}
	if (!response.body) {
		console.error("Empty response body");
		process.exit(1);
	}

	const types = new Set();
	for await (const event of assembleStream(
		response.body,
		openaiCompatibleAdapter({ provider: "ollama" }),
	)) {
		types.add(event.type);
		console.log(event.type);
	}

	if (!types.has("text.delta")) {
		console.error("Expected at least one text.delta event");
		process.exit(1);
	}

	console.log("\nEvent types seen:", [...types].sort().join(", "));
}

await main();
