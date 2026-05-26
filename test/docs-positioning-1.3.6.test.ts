import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(path: string): string {
	return readFileSync(join(rootDir, path), "utf8");
}

describe("docs positioning 1.3.6 integration cookbook", () => {
	const readme = () => read("README.md");

	it("LSA-DOC35: docs/integration-cookbook.md exists with status 1.3.6", () => {
		expect(existsSync(join(rootDir, "docs/integration-cookbook.md"))).toBe(true);
		expect(read("docs/integration-cookbook.md")).toContain("1.3.6");
	});

	it("LSA-DOC36: integration cookbook documents Hono and Express paths", () => {
		const doc = read("docs/integration-cookbook.md");
		expect(doc).toContain("hono-proxy.ts");
		expect(doc).toContain("express-proxy.ts");
	});

	it("LSA-DOC37: integration cookbook documents Cloudflare Worker without node:fs", () => {
		const doc = read("docs/integration-cookbook.md");
		expect(doc).toContain("cloudflare-worker-proxy.ts");
		expect(doc).toMatch(/no `node:fs`/i);
	});

	it("LSA-DOC38: integration cookbook documents LiteLLM OpenAI-compatible proxy", () => {
		const doc = read("docs/integration-cookbook.md");
		expect(doc).toContain("litellm-openai-compatible.ts");
		expect(doc).toMatch(/LITELLM_BASE_URL|OPENAI_COMPATIBLE_BASE_URL/);
	});

	it("LSA-DOC39: integration cookbook documents AI SDK mapping without peer dep", () => {
		const doc = read("docs/integration-cookbook.md");
		expect(doc).toContain("stream-event-to-ai-sdk-parts.ts");
		expect(doc).toMatch(/does \*\*not\*\* ship|no `@ai-sdk/i);
	});

	it("LSA-DOC40: integration cookbook documents LangChain callback pattern", () => {
		expect(read("docs/integration-cookbook.md")).toContain("langchain-callback-pattern.ts");
	});

	it("LSA-DOC41: README contains Integration cookbook and links integration-cookbook.md", () => {
		const text = readme();
		expect(text).toContain("Integration cookbook");
		expect(text).toContain("docs/integration-cookbook.md");
	});

	it("LSA-DOC42: README Documentation list includes integration-cookbook", () => {
		expect(readme()).toContain("./docs/integration-cookbook.md");
	});

	it("LSA-DOC43: CHANGELOG contains 1.3.6 and integration-cookbook", () => {
		const changelog = read("CHANGELOG.md");
		expect(changelog).toContain("## [1.3.6]");
		expect(changelog).toContain("integration-cookbook");
	});

	it("LSA-DOC44: examples README references integrations/", () => {
		expect(read("examples/README.md")).toContain("integrations/");
	});

	it("LSA-DOC45: FAQ references docs/integration-cookbook.md", () => {
		expect(read("docs/faq.md")).toContain("docs/integration-cookbook.md");
	});

	it("LSA-DOC46: FAQ headings include integration question", () => {
		const faq = read("docs/faq.md");
		expect(faq).toMatch(/integrate with Hono, Express, Cloudflare Workers/i);
	});

	it("LSA-DOC47: integration cookbook documents collectStream and createAssemblyTransform", () => {
		const doc = read("docs/integration-cookbook.md");
		expect(doc).toContain("collect-stream-handler.ts");
		expect(doc).toContain("assembly-transform-pipeline.ts");
		expect(doc).toContain("createAssemblyTransform");
	});

	it("LSA-DOC48: integration cookbook documents Next.js App Route", () => {
		expect(read("docs/integration-cookbook.md")).toContain("nextjs-app-route.ts");
	});

	it("LSA-DOC49: integration cookbook documents edge cases section with INT test IDs", () => {
		const doc = read("docs/integration-cookbook.md");
		expect(doc).toMatch(/Edge cases/i);
		expect(doc).toContain("LSA-INT21");
		expect(doc).toContain("LSA-INT37");
	});

	it("LSA-DOC50: integration cookbook documents replay-integration-mapper offline path", () => {
		expect(read("docs/integration-cookbook.md")).toContain("replay-integration-mapper.ts");
	});
});
