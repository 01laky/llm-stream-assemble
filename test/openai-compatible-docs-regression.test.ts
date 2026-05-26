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
			"groq/",
			"deepseek/",
			"mistral/",
			"ollama/",
			"lmstudio/",
			"together/",
			"fireworks/",
			"openrouter/",
			"perplexity/",
			"xai/",
			"azure/",
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

	it("LSA-OC80: fixture README lists host subfolders and root fixture families", () => {
		const readme = readFileSync(join(rootDir, "test/fixtures/openai-compatible/README.md"), "utf8");
		for (const folder of [
			"groq/",
			"deepseek/",
			"mistral/",
			"ollama/",
			"lmstudio/",
			"together/",
			"fireworks/",
			"openrouter/",
			"perplexity/",
			"xai/",
			"azure/",
		]) {
			expect(readme).toContain(folder);
		}
	});

	it("LSA-OC81: README provider preset table includes deepseek and mistral with base URLs", () => {
		const readme = readFileSync(join(rootDir, "README.md"), "utf8");
		expect(readme).toContain("`deepseek`");
		expect(readme).toContain("`mistral`");
		expect(readme).toContain("api.deepseek.com");
		expect(readme).toContain("api.mistral.ai");
	});

	it("LSA-OC82: compatibility docs quirks rows cover host presets", () => {
		const docs = readFileSync(join(rootDir, "docs/compatibility.md"), "utf8");
		for (const host of [
			"Groq",
			"DeepSeek",
			"Mistral",
			"Ollama",
			"LM Studio",
			"Together",
			"Fireworks",
			"OpenRouter",
			"Azure OpenAI",
		]) {
			expect(docs).toContain(host);
		}
	});

	it("LSA-OC83: CHANGELOG documents 1.1.5 preset expansion", () => {
		const changelog = readFileSync(join(rootDir, "CHANGELOG.md"), "utf8");
		expect(changelog).toContain("## [1.1.5]");
		expect(changelog).toContain("deepseek");
		expect(changelog).toContain("mistral");
	});

	it("LSA-OC84: package.json version is 1.2.0", () => {
		const pkg = JSON.parse(readFileSync(join(rootDir, "package.json"), "utf8")) as {
			version: string;
		};
		expect(pkg.version).toBe("1.2.0");
	});

	it("LSA-OC103: README preset table includes azure with deployment URL pattern", () => {
		const readme = readFileSync(join(rootDir, "README.md"), "utf8");
		expect(readme).toContain("`azure`");
		expect(readme).toContain("openai.azure.com");
		expect(readme).toContain("/deployments/");
	});

	it("LSA-OC104: compatibility docs quirks rows cover Perplexity and xAI", () => {
		const docs = readFileSync(join(rootDir, "docs/compatibility.md"), "utf8");
		expect(docs).toContain("Perplexity");
		expect(docs).toContain("xAI");
	});

	it("LSA-OC105: CHANGELOG documents 1.2.0 Azure preset expansion", () => {
		const changelog = readFileSync(join(rootDir, "CHANGELOG.md"), "utf8");
		expect(changelog).toContain("## [1.2.0]");
		expect(changelog).toContain("azure");
	});

	it("LSA-OC106: package.json version is 1.2.0", () => {
		const pkg = JSON.parse(readFileSync(join(rootDir, "package.json"), "utf8")) as {
			version: string;
		};
		expect(pkg.version).toBe("1.2.0");
	});

	it("LSA-OC107: README badges and stable status reference 1.2.0", () => {
		const readme = readFileSync(join(rootDir, "README.md"), "utf8");
		expect(readme).toContain("1.2.0");
		expect(readme).toContain("Stable `1.2.0`");
	});

	it("LSA-OC112: dist openai-compatible.d.ts exports perplexity, xai, and azure preset keys", () => {
		const dts = readFileSync(join(rootDir, "dist/adapters/openai-compatible.d.ts"), "utf8");
		expect(dts).toContain('"perplexity"');
		expect(dts).toContain('"xai"');
		expect(dts).toContain('"azure"');
	});

	it("LSA-OC131: README Azure OpenAI Usage subsection documents api-key and deployment path", () => {
		const readme = readFileSync(join(rootDir, "README.md"), "utf8");
		expect(readme).toContain("Azure OpenAI Usage");
		expect(readme).toContain("api-key");
	});

	it("LSA-OC132: compatibility docs Azure OpenAI quirks cover strict preset and content filter", () => {
		const docs = readFileSync(join(rootDir, "docs/compatibility.md"), "utf8");
		expect(docs).toContain("Azure OpenAI");
		expect(docs).toContain("content_filter");
	});

	it("LSA-OC133: CHANGELOG documents 1.2.0 preset expansion", () => {
		const changelog = readFileSync(join(rootDir, "CHANGELOG.md"), "utf8");
		expect(changelog).toContain("## [1.2.0]");
		expect(changelog).toContain("LSA-OC113");
	});

	it("LSA-OC134: package.json version is 1.2.0", () => {
		const pkg = JSON.parse(readFileSync(join(rootDir, "package.json"), "utf8")) as {
			version: string;
		};
		expect(pkg.version).toBe("1.2.0");
	});

	it("LSA-OC135: README badges and stable status reference 1.2.0 release", () => {
		const readme = readFileSync(join(rootDir, "README.md"), "utf8");
		expect(readme).toMatch(/1\.2\.0/);
		expect(readme).toContain("Stable `1.2.0`");
	});

	it("LSA-OC136: dist openai-compatible.d.ts includes azure in OpenAICompatibleProvider", () => {
		const dts = readFileSync(join(rootDir, "dist/adapters/openai-compatible.d.ts"), "utf8");
		expect(dts).toContain('"azure"');
	});

	it("LSA-OC137: adapter guide warns against using azure preset for non-Azure hosts", () => {
		const guide = readFileSync(join(rootDir, "docs/adapter-guide.md"), "utf8");
		expect(guide).toMatch(/azure/i);
		expect(guide).toMatch(/non-Azure|not Azure|generic/i);
	});
});
