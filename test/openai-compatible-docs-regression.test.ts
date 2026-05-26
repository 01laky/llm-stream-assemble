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
			"cloudflare/",
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
			"cloudflare/",
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

	it("LSA-OC84: package.json version is 1.3.0", () => {
		const pkg = JSON.parse(readFileSync(join(rootDir, "package.json"), "utf8")) as {
			version: string;
		};
		expect(pkg.version).toBe("1.3.0");
	});

	it("LSA-OC103: README preset table includes azure with deployment URL pattern", () => {
		const readme = readFileSync(join(rootDir, "README.md"), "utf8");
		expect(readme).toContain("`azure`");
		expect(readme).toContain("openai.azure.com");
		expect(readme).toContain("/deployments/");
	});

	it("LSA-OC104: compatibility docs quirks rows cover Perplexity, xAI, and Cloudflare Workers AI", () => {
		const docs = readFileSync(join(rootDir, "docs/compatibility.md"), "utf8");
		expect(docs).toContain("Perplexity");
		expect(docs).toContain("xAI");
		expect(docs).toMatch(/Cloudflare Workers AI/i);
	});

	it("LSA-OC105: CHANGELOG documents 1.2.0 Azure preset expansion", () => {
		const changelog = readFileSync(join(rootDir, "CHANGELOG.md"), "utf8");
		expect(changelog).toContain("## [1.2.0]");
		expect(changelog).toContain("azure");
	});

	it("LSA-OC106: package.json version is 1.3.0", () => {
		const pkg = JSON.parse(readFileSync(join(rootDir, "package.json"), "utf8")) as {
			version: string;
		};
		expect(pkg.version).toBe("1.3.0");
	});

	it("LSA-OC107: README badges and stable status reference 1.3.0", () => {
		const readme = readFileSync(join(rootDir, "README.md"), "utf8");
		expect(readme).toContain("1.3.0");
		expect(readme).toContain("Stable `1.3.0`");
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

	it("LSA-OC134: package.json version is 1.3.0", () => {
		const pkg = JSON.parse(readFileSync(join(rootDir, "package.json"), "utf8")) as {
			version: string;
		};
		expect(pkg.version).toBe("1.3.0");
	});

	it("LSA-OC135: README badges and stable status reference 1.3.0 release", () => {
		const readme = readFileSync(join(rootDir, "README.md"), "utf8");
		expect(readme).toMatch(/1\.3\.0/);
		expect(readme).toContain("Stable `1.3.0`");
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

	it("LSA-OC159: README preset table includes cloudflare and api.cloudflare.com", () => {
		const readme = readFileSync(join(rootDir, "README.md"), "utf8");
		expect(readme).toContain("`cloudflare`");
		expect(readme).toContain("api.cloudflare.com");
	});

	it("LSA-OC160: README documents Cloudflare Workers AI Usage subsection", () => {
		const readme = readFileSync(join(rootDir, "README.md"), "utf8");
		expect(readme).toMatch(/Cloudflare Workers AI Usage/i);
		expect(readme).toContain("CLOUDFLARE_API_TOKEN");
	});

	it("LSA-OC161: compatibility docs quirks row for Cloudflare Workers AI", () => {
		const docs = readFileSync(join(rootDir, "docs/compatibility.md"), "utf8");
		expect(docs).toMatch(/Cloudflare Workers AI/i);
		expect(docs).toContain("sparse metadata");
	});

	it("LSA-OC162: CHANGELOG documents 1.3.0 cloudflare preset and LSA-OC142", () => {
		const changelog = readFileSync(join(rootDir, "CHANGELOG.md"), "utf8");
		expect(changelog).toContain("## [1.3.0]");
		expect(changelog).toContain("cloudflare");
		expect(changelog).toContain("json-mode");
		expect(changelog).toContain("LSA-OC142");
	});

	it("LSA-OC163: dist openai-compatible.d.ts includes cloudflare and source has no PRESET_OVERRIDES entry", () => {
		const dts = readFileSync(join(rootDir, "dist/adapters/openai-compatible.d.ts"), "utf8");
		expect(dts).toContain('"cloudflare"');
		const source = readFileSync(join(rootDir, "src/adapters/openai-compatible.ts"), "utf8");
		expect(source).not.toMatch(/^\s*cloudflare\s*:/m);
	});

	it("LSA-OC164: adapter guide lists cloudflare Workers AI REST preset", () => {
		const guide = readFileSync(join(rootDir, "docs/adapter-guide.md"), "utf8");
		expect(guide).toContain("cloudflare");
		expect(guide).toMatch(/Workers AI|Workers AI REST|REST endpoint/i);
	});

	it("LSA-OC165: adapters-overview.mmd preset list includes cloudflare and stable 1.3.0", () => {
		const mmd = readFileSync(join(rootDir, "docs/img/adapters-overview.mmd"), "utf8");
		expect(mmd).toContain("cloudflare");
		expect(mmd).toContain("1.3.0");
	});

	it("LSA-OC166: pipeline.mmd OpenAI-compatible hosts mention Cloudflare", () => {
		const mmd = readFileSync(join(rootDir, "docs/img/pipeline.mmd"), "utf8");
		expect(mmd).toMatch(/Cloudflare/i);
	});

	it("LSA-OC167: provider roadmap §10 targets 1.3.0 for Cloudflare Workers AI", () => {
		const roadmap = readFileSync(join(rootDir, "docs/post-1.0-provider-roadmap.md"), "utf8");
		expect(roadmap).toMatch(/### 10\. Cloudflare Workers AI/);
		expect(roadmap).toMatch(/\*\*Target version:\*\* `1\.3\.0`/);
		expect(roadmap).not.toMatch(/1\.6\.0\s+Cloudflare Workers AI preset/);
	});

	it("LSA-OC168: README architecture section mentions cloudflare preset", () => {
		const readme = readFileSync(join(rootDir, "README.md"), "utf8");
		expect(readme).toContain("docs/img/adapters-overview.svg");
		expect(readme).toContain("`cloudflare`");
	});
});
