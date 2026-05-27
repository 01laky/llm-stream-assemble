#!/usr/bin/env node
/**
 * Live smoke: Vertex AI Gemini streamGenerateContent (maintainer-only, not CI).
 * Usage: pnpm smoke:vertex [--capture]
 */
/* global fetch */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const capture = process.argv.includes("--capture");

function tokenFromEnv() {
	if (process.env.VERTEX_ACCESS_TOKEN) return process.env.VERTEX_ACCESS_TOKEN;
	try {
		return execFileSync("gcloud", ["auth", "print-access-token"], { encoding: "utf8" }).trim();
	} catch {
		return undefined;
	}
}

async function main() {
	const project = process.env.GOOGLE_CLOUD_PROJECT;
	const location = process.env.VERTEX_LOCATION ?? "us-central1";
	const model = process.env.VERTEX_MODEL ?? "gemini-2.5-flash";
	const token = tokenFromEnv();

	if (!project) {
		console.error("Set GOOGLE_CLOUD_PROJECT");
		process.exit(1);
	}
	if (!token) {
		console.error("Set VERTEX_ACCESS_TOKEN or run gcloud auth application-default login");
		process.exit(1);
	}

	const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/${model}:streamGenerateContent`;

	const response = await fetch(url, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			contents: [{ role: "user", parts: [{ text: "Reply with one word: ok" }] }],
		}),
	});

	if (!response.ok) {
		console.error("Vertex HTTP", response.status, await response.text());
		process.exit(1);
	}

	const text = await response.text();
	console.log("--- raw stream (first 500 chars) ---");
	console.log(text.slice(0, 500));

	if (capture) {
		const outDir = join(root, ".local-playground/vertex-capture");
		mkdirSync(outDir, { recursive: true });
		const outPath = join(outDir, `capture-${Date.now()}.txt`);
		writeFileSync(outPath, text, "utf8");
		console.log(`\nWrote capture to ${outPath}`);
		console.log(
			"Maintainer: redact, compare to test/fixtures/gemini/vertex/, regenerate expected.",
		);
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
