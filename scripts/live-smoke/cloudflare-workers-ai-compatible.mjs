/**
 * Maintainer-only live smoke for Cloudflare Workers AI OpenAI-compatible streaming.
 * Run: pnpm build && pnpm smoke:cloudflare
 */
/* global fetch */
import { assembleStream, openaiCompatibleAdapter } from "../../dist/index.js";

const apiToken = process.env.CLOUDFLARE_API_TOKEN;
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const model = process.env.CLOUDFLARE_MODEL ?? "@cf/meta/llama-3.1-8b-instruct";

if (!apiToken) {
	console.error("Set CLOUDFLARE_API_TOKEN");
	process.exit(1);
}
if (!accountId) {
	console.error("Set CLOUDFLARE_ACCOUNT_ID");
	process.exit(1);
}

const types = new Set();

const response = await fetch(
	`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/chat/completions`,
	{
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiToken}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			model,
			messages: [{ role: "user", content: "Reply with one short word." }],
			stream: true,
			stream_options: { include_usage: true },
		}),
	},
);

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
	openaiCompatibleAdapter({ provider: "cloudflare" }),
)) {
	types.add(event.type);
}

console.log("event types:", [...types].sort().join(", "));
