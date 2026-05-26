/**
 * Maintainer-only live smoke for Google AI Gemini streaming.
 * Run: pnpm build && pnpm exec tsx scripts/live-smoke/gemini.ts
 */
import { geminiAdapter, assembleStream } from "../../dist/index.js";

const apiKey = process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY;
const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

if (!apiKey) {
	console.error("Set GOOGLE_API_KEY or GEMINI_API_KEY");
	process.exit(1);
}

const types = new Set<string>();

async function streamPrompt(body: unknown, label: string) {
	console.log(`\n--- ${label} ---`);
	const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;
	const response = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
	if (!response.ok) {
		console.error(`HTTP ${response.status}`);
		process.exit(1);
	}
	if (!response.body) {
		console.error("Empty response body");
		process.exit(1);
	}
	for await (const event of assembleStream(response.body, geminiAdapter())) {
		types.add(event.type);
		console.log(event.type);
	}
}

await streamPrompt(
	{ contents: [{ role: "user", parts: [{ text: "Reply with one short word." }] }] },
	"text",
);

if (process.env.GEMINI_SMOKE_TOOLS === "1") {
	await streamPrompt(
		{
			contents: [{ role: "user", parts: [{ text: "What is 2+2? Use the calculator tool." }] }],
			tools: [
				{
					functionDeclarations: [
						{
							name: "calculator",
							description: "Evaluate a math expression",
							parameters: {
								type: "OBJECT",
								properties: { expression: { type: "STRING" } },
							},
						},
					],
				},
			],
		},
		"tool (optional)",
	);
}

console.log("\nEvent types seen:", [...types].sort().join(", "));
