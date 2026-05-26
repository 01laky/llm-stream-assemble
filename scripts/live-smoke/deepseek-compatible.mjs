/**
 * Maintainer-only live smoke for DeepSeek OpenAI-compatible streaming.
 * Run: pnpm build && pnpm smoke:deepseek
 */
/* global fetch */
import { assembleStream, openaiCompatibleAdapter } from "../../dist/index.js";

const apiKey = process.env.DEEPSEEK_API_KEY;
const baseUrl = (process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com").replace(/\/$/, "");
const model = process.env.DEEPSEEK_MODEL ?? "deepseek-chat";

if (!apiKey) {
	console.error("Set DEEPSEEK_API_KEY");
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
	openaiCompatibleAdapter({ provider: "deepseek" }),
)) {
	types.add(event.type);
	console.log(event.type);
}

if (!types.has("text.delta")) {
	console.error("Expected at least one text.delta event");
	process.exit(1);
}

console.log("\nEvent types seen:", [...types].sort().join(", "));
