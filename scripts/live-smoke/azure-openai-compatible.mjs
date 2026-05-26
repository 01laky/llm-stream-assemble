/**
 * Maintainer-only live smoke for Azure OpenAI Chat Completions streaming.
 * Run: pnpm build && pnpm smoke:azure
 */
/* global fetch */
import { assembleStream, openaiCompatibleAdapter } from "../../dist/index.js";

const apiKey = process.env.AZURE_OPENAI_API_KEY;
const resource = process.env.AZURE_OPENAI_RESOURCE;
const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
const apiVersion = process.env.AZURE_OPENAI_API_VERSION ?? "2024-10-21";

if (!apiKey || !resource || !deployment) {
	console.error("Set AZURE_OPENAI_API_KEY, AZURE_OPENAI_RESOURCE, and AZURE_OPENAI_DEPLOYMENT");
	process.exit(1);
}

const types = new Set();
const url = `https://${resource}.openai.azure.com/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;

const response = await fetch(url, {
	method: "POST",
	headers: {
		"api-key": apiKey,
		"Content-Type": "application/json",
	},
	body: JSON.stringify({
		messages: [{ role: "user", content: "Reply with one short word." }],
		stream: true,
		stream_options: { include_usage: true },
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
	openaiCompatibleAdapter({ provider: "azure" }),
)) {
	types.add(event.type);
	console.log(event.type);
}

if (!types.has("text.delta")) {
	console.error("Expected at least one text.delta event");
	process.exit(1);
}

console.log("\nEvent types seen:", [...types].sort().join(", "));
