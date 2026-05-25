import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { openaiChatAdapter } from "../src/adapters/openai-chat";
import { openaiCompatibleAdapter } from "../src/adapters/openai-compatible";
import { normalizeCompatibleRawChunks } from "./helpers/compatible-fixtures";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("openaiCompatibleAdapter docs and regression guards", () => {
	it("LSA-OC41: fixture provenance README references every compatible fixture family", () => {
		const readme = readFileSync(join(rootDir, "test/fixtures/openai-compatible/README.md"), "utf8");
		for (const name of [
			"generic-text",
			"missing-metadata",
			"missing-choice-index",
			"missing-tool-id",
			"loose-error-string",
			"reasoning-alias",
			"usage-alias",
			"json-mode",
			"response-generic",
			"response-loose-error",
		]) {
			expect(readme).toContain(name);
		}
	});

	it("LSA-OC42: compatibility docs mark OpenAI-compatible as supported with notes", () => {
		const docs = readFileSync(join(rootDir, "docs/compatibility.md"), "utf8");
		expect(docs).toContain("`openaiCompatibleAdapter` | yes");
		expect(docs).toContain("OpenAI-compatible limitations");
	});

	it("LSA-OC43: README mentions OpenAI-compatible usage and status", () => {
		const readme = readFileSync(join(rootDir, "README.md"), "utf8");
		expect(readme).toContain("OpenAI-Compatible Usage");
		expect(readme).toContain("OpenAI-compatible");
	});

	it("LSA-OC44: README contains a provider preset table", () => {
		const readme = readFileSync(join(rootDir, "README.md"), "utf8");
		expect(readme).toContain("Provider presets:");
		expect(readme).toContain("`openrouter`");
		expect(readme).toContain("OpenRouter");
		expect(readme).toContain("`ollama`");
		expect(readme).toContain("Ollama");
	});

	it("LSA-OC45: README documents strict vs loose mode examples", () => {
		const readme = readFileSync(join(rootDir, "README.md"), "utf8");
		expect(readme).toContain("Strict vs loose configuration");
		expect(readme).toContain("allowMissingMetadata: false");
		expect(readme).toContain("looseErrorShape: false");
	});

	it("LSA-OC46: generic compatible raw chunks match OpenAI Chat for OpenAI-shaped payloads", () => {
		const raw = JSON.stringify({
			id: "chatcmpl_guard",
			model: "gpt-4o-mini",
			choices: [{ index: 0, delta: { content: "guard" }, finish_reason: "stop" }],
		});
		expect(normalizeCompatibleRawChunks(openaiCompatibleAdapter().parseChunk(raw))).toEqual(
			normalizeCompatibleRawChunks(openaiChatAdapter().parseChunk(raw)),
		);
	});
});
