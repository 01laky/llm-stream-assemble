import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(path: string): string {
	return readFileSync(join(rootDir, path), "utf8");
}

describe("docs positioning 1.5.0 cohere", () => {
	it("LSA-DOC65: CHANGELOG documents 1.5.0 Cohere release", () => {
		const changelog = read("CHANGELOG.md");
		expect(changelog).toContain("## [1.5.0]");
		expect(changelog).toContain("cohereAdapter");
	});

	it("LSA-DOC66: adapters-overview.mmd/svg contains cohereAdapter", () => {
		const mmd = read("docs/img/adapters-overview.mmd");
		expect(mmd).toContain("cohereAdapter");
		expect(existsSync(join(rootDir, "docs/img/adapters-overview.svg"))).toBe(true);
		expect(read("docs/img/adapters-overview.svg")).toContain("cohereAdapter");
	});

	it("LSA-DOC67: post-1.0 roadmap marks 1.5.0 Cohere shipped", () => {
		const roadmap = read("docs/post-1.0-provider-roadmap.md");
		expect(roadmap).toMatch(/1\.5\.0.*✅|1\.5\.0.*shipped|Cohere.*1\.5\.0/i);
	});

	it("LSA-DOC68: test/fixtures/cohere/README.md exists with provenance table", () => {
		const fixtureReadme = read("test/fixtures/cohere/README.md");
		expect(fixtureReadme).toMatch(/provenance|source|docs-shaped/i);
		expect(fixtureReadme).toContain("|");
	});

	it("LSA-DOC69: README mentions Cohere or seven built-in adapters", () => {
		const readme = read("README.md");
		expect(readme).toMatch(/cohereAdapter|seven built-in|7 built-in/i);
	});

	it("LSA-DOC70: FAQ headings include Cohere not OpenAI-compatible question", () => {
		expect(read("docs/faq.md")).toMatch(
			/Is Cohere OpenAI-compatible|Cohere.*not.*OpenAI-compatible/i,
		);
	});

	it("LSA-DOC71: package.json exports cohere adapter subpath", () => {
		const pkg = JSON.parse(read("package.json")) as { exports: Record<string, unknown> };
		expect(pkg.exports["./adapters/cohere"]).toBeDefined();
	});

	it("LSA-DOC72: live-smoke.md contains Cohere v2 Chat section", () => {
		expect(read("docs/live-smoke.md")).toMatch(/Cohere v2|smoke:cohere/i);
	});

	it("LSA-DOC73: integration-cookbook.md references cohere-proxy.ts", () => {
		expect(read("docs/integration-cookbook.md")).toContain("cohere-proxy.ts");
	});

	it("LSA-DOC74: CHANGELOG 1.5.0 lists release test ids REL INT X63", () => {
		const changelog = read("CHANGELOG.md");
		const section = changelog.split("## [1.5.0]")[1]?.split("## [1.4.1]")[0] ?? "";
		expect(section).toContain("LSA-REL23");
		expect(section).toContain("LSA-INT42");
		expect(section).toContain("LSA-X63");
		expect(section).toContain("1316");
	});
});
