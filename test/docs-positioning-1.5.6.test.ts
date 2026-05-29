import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(path: string): string {
	return readFileSync(join(rootDir, path), "utf8");
}

const COMPOSABLE_ABOUT =
	"A composable TypeScript layer between raw LLM provider bytes and your app: seven built-in adapters, thirteen host presets, and a single StreamEvent model for text, tools, reasoning, JSON, and lifecycle — from Ollama to Azure to Vertex AI to Bedrock to Cohere to Cloudflare Workers AI.";

describe("docs positioning 1.5.6", () => {
	it("LSA-DOC89: README blockquote uses composable About with Vertex AI sweep", () => {
		const readme = read("README.md") + read("docs/usage-guides.md");
		expect(readme).toContain(COMPOSABLE_ABOUT);
		expect(readme).not.toContain("A zero-dependency TypeScript layer");
	});

	it("LSA-DOC90: package.json description is composable and mentions Vertex AI", () => {
		const pkg = JSON.parse(read("package.json")) as { description?: string };
		expect(pkg.description).toMatch(/Composable/i);
		expect(pkg.description).toMatch(/Vertex AI/i);
		expect(pkg.description).toMatch(/StreamEvent/i);
	});

	it("LSA-DOC91: package.json keywords include discovery terms for Vertex and composable", () => {
		const pkg = JSON.parse(read("package.json")) as { keywords?: string[] };
		const keywords = pkg.keywords ?? [];
		for (const term of [
			"vertex-ai",
			"azure-openai",
			"openai-compatible",
			"stream-events",
			"composable",
			"json-mode",
			"reasoning",
		]) {
			expect(keywords).toContain(term);
		}
	});

	it("LSA-DOC92: CHANGELOG contains 1.5.6 release section", () => {
		const changelog = read("CHANGELOG.md") + read("CHANGELOG-archive.md");
		expect(changelog).toContain("## [1.5.6]");
		expect(changelog).toMatch(/composable|edge-case/i);
	});

	it("LSA-DOC93: CHANGELOG 1.5.6 section remains for historical traceability", () => {
		expect(read("CHANGELOG.md") + read("CHANGELOG-archive.md")).toContain("## [1.5.6]");
	});

	it("LSA-DOC94: README and CHANGELOG still reference 1.5.6 release history", () => {
		const readme = read("README.md") + read("docs/usage-guides.md");
		const changelog = read("CHANGELOG.md") + read("CHANGELOG-archive.md");
		expect(changelog).toContain("## [1.5.6]");
		expect(readme).toContain("CHANGELOG.md");
	});

	it("LSA-DOC95: active docs retain 1.5.6 traceability in edge-cases or CHANGELOG", () => {
		expect(read("CHANGELOG.md") + read("CHANGELOG-archive.md")).toContain("## [1.5.6]");
		expect(read("docs/edge-cases.md")).toMatch(/1\.5\.6/);
	});

	it("LSA-DOC96: comparison.md positioning uses composable language", () => {
		const doc = read("docs/comparison.md");
		expect(doc).toMatch(/composable TypeScript stream assembly layer/i);
		expect(doc).toMatch(/zero runtime dependencies/i);
	});
});
