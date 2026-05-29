import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(path: string): string {
	return readFileSync(join(rootDir, path), "utf8");
}

describe("gemini vertex docs regression", () => {
	it("LSA-DOC75: CHANGELOG contains 1.5.5 and Vertex", () => {
		expect(read("CHANGELOG.md") + read("CHANGELOG-archive.md")).toContain("## [1.5.5]");
		expect(read("CHANGELOG.md") + read("CHANGELOG-archive.md")).toMatch(/Vertex|apiSurface/i);
	});

	it("LSA-DOC76: CHANGELOG 1.5.5 section remains for historical traceability", () => {
		expect(read("CHANGELOG.md") + read("CHANGELOG-archive.md")).toContain("## [1.5.5]");
	});

	it("LSA-DOC77: README mentions apiSurface vertex", () => {
		expect(read("README.md")).toMatch(/apiSurface.*vertex|vertex.*apiSurface/i);
	});

	it("LSA-DOC78: adapter-guide documents normalizeVertexChunk", () => {
		expect(read("docs/adapter-guide.md")).toContain("normalizeVertexChunk");
	});

	it("LSA-DOC79: compatibility.md no longer defers Vertex streaming", () => {
		const doc = read("docs/compatibility.md");
		expect(doc).toMatch(/Vertex|apiSurface.*vertex/i);
		expect(doc).not.toContain("Deferred — adapter targets Google AI");
	});

	it("LSA-DOC80: .env.example contains GOOGLE_CLOUD_PROJECT", () => {
		expect(read(".env.example")).toContain("GOOGLE_CLOUD_PROJECT");
	});

	it("LSA-DOC81: package.json scripts include smoke:vertex", () => {
		const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
		expect(pkg.scripts["smoke:vertex"]).toBeDefined();
	});

	it("LSA-DOC82: vertex fixture README exists", () => {
		expect(existsSync(join(rootDir, "test/fixtures/gemini/vertex/README.md"))).toBe(true);
	});
});

describe("docs positioning 1.5.5 vertex", () => {
	it("LSA-DOC83: CHANGELOG documents 1.5.5 Vertex release", () => {
		const changelog = read("CHANGELOG.md") + read("CHANGELOG-archive.md");
		expect(changelog).toContain("## [1.5.5]");
		expect(changelog).toContain("apiSurface");
	});

	it("LSA-DOC84: README about blockquote mentions Vertex AI", () => {
		expect(read("README.md")).toMatch(/Vertex AI/i);
	});

	it("LSA-DOC85: post-1.0 roadmap marks 1.5.5 Vertex shipped", () => {
		expect(read("docs/post-1.0-provider-roadmap.md")).toMatch(/1\.5\.5.*Vertex|Vertex.*1\.5\.5/i);
	});

	it("LSA-DOC86: examples/node-fetch/vertex-gemini.ts exists", () => {
		expect(existsSync(join(rootDir, "examples/node-fetch/vertex-gemini.ts"))).toBe(true);
	});

	it("LSA-DOC87: verify script includes fixtures:check-gemini", () => {
		expect(read("package.json")).toContain("fixtures:check-gemini");
	});

	it("LSA-DOC88: integration-cookbook references vertex-gemini.ts", () => {
		expect(read("docs/integration-cookbook.md")).toContain("vertex-gemini.ts");
	});
});
