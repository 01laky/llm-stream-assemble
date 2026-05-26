/**
 * Maintainer-only live smoke for Perplexity OpenAI-compatible streaming.
 * Run: pnpm build && pnpm smoke:perplexity
 */
/* global fetch */
import { assembleStream, openaiCompatibleAdapter } from "../../dist/index.js";

const apiKey = process.env.PERPLEXITY_API_KEY;
const baseUrl = (process.env.PERPLEXITY_BASE_URL ?? "https://api.perplexity.ai").replace(/\/$/, "");
const model = process.env.PERPLEXITY_MODEL ?? "sonar";

if (!apiKey) {
	console.error("Set PERPLEXITY_API_KEY");
	process.exit(1);
}

const types = new Set();

const response = await fetch(`${baseUrl}/chat/completions`, {
	method: "POST",
	headers: {
		Authorization: `Bearer ${apiKey}`,
		"Content-Type": "application/json",
	},
	body: JSON.stringify({
		model,
		messages: [{ role: "user", content: "Reply with one short word." }],
		stream: true,
	}),
});

if (!response.ok) {
	console.error(`HTTP ${response.status}`);
	process.exit(1);
}
if (!response.body) {
	console.error("Empty response body");
	process.exit(1);
}

for await (const event of assembleStream(
	response.body,
	openaiCompatibleAdapter({ provider: "perplexity" }),
)) {
	types.add(event.type);
	console.log(event.type);
}

if (!types.has("text.delta")) {
	console.error("Expected at least one text.delta event");
	process.exit(1);
}

console.log("\nEvent types seen:", [...types].sort().join(", "));
