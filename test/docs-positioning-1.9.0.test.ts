import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(path: string): string {
	return readFileSync(join(rootDir, path), "utf8");
}

describe("docs positioning 1.9.0", () => {
	it("LSA-DOC182: README test badge >= 4000", () => {
		const readme = read("README.md");
		const match = readme.match(/tests-(\d+)_passing/);
		expect(match).not.toBeNull();
		expect(Number(match![1])).toBeGreaterThanOrEqual(4000);
	});

	it("LSA-DOC183: docs/testing-strategy.md exists with Zero API key policy", () => {
		const doc = read("docs/testing-strategy.md");
		expect(doc).toContain("Zero paid provider API");
		expect(doc).toContain("Zero API key CI policy");
	});

	it("LSA-DOC184: CHANGELOG 1.9.0 mentions chunk-split matrix", () => {
		const section = read("CHANGELOG.md").split("## [1.9.0]")[1]?.split("## [1.8.1]")[0] ?? "";
		expect(section).toMatch(/chunk-split|Chunk-split/i);
	});

	it("LSA-DOC185: testing-strategy links REGISTRY", () => {
		expect(read("docs/testing-strategy.md")).toContain("test/fixtures/REGISTRY.md");
	});

	it("LSA-DOC186: adapter-guide links testing-strategy", () => {
		expect(read("docs/adapter-guide.md")).toMatch(/testing-strategy\.md/);
	});

	it("LSA-DOC187: roadmap conformance harness marked implemented", () => {
		const roadmap = read("docs/post-1.0-provider-roadmap.md");
		expect(roadmap).toMatch(/Adapter conformance harness.*implemented|implemented.*1\.9\.0/i);
	});

	it("LSA-DOC188: chunk-split-matrix test file exists", () => {
		expect(read("test/chunk-split-matrix.test.ts")).toContain("chunk-split matrix");
	});

	it("LSA-DOC189: simulated-provider-e2e test file exists", () => {
		expect(read("test/simulated-provider-e2e.test.ts")).toContain("simulated provider");
	});

	it("LSA-DOC190: README Stable 1.9.0", () => {
		expect(read("README.md")).toMatch(/Stable `1\.9\.0`/);
	});

	it("LSA-DOC191: parse-response-chunk-matrix test exists", () => {
		expect(read("test/parse-response-chunk-matrix.test.ts")).toContain("parseResponse");
	});

	it("LSA-DOC192: replay-fixture-matrix test exists", () => {
		expect(read("test/replay-fixture-matrix.test.ts")).toContain("replay fixture");
	});

	it("LSA-DOC193: malformed-stream-matrix and fixtures/malformed exist", () => {
		expect(read("test/malformed-stream-matrix.test.ts")).toContain("malformed");
		expect(read("test/fixtures/malformed/README.md")).toBeTruthy();
	});

	it("LSA-DOC194: testing-strategy documents evil offsets and parseResponse matrix", () => {
		const doc = read("docs/testing-strategy.md");
		expect(doc).toMatch(/Evil offset|evil offset/i);
		expect(doc).toMatch(/parseResponse/i);
	});

	it("LSA-DOC195: testing-strategy documents MAINT39 duration gate", () => {
		expect(read("docs/testing-strategy.md")).toMatch(/MAINT39|55s/);
	});

	it("LSA-DOC196: testing-strategy performance budget section", () => {
		expect(read("docs/testing-strategy.md")).toContain("Performance budget");
	});

	it("LSA-DOC197: package.json version is 1.9.0", () => {
		const pkg = JSON.parse(read("package.json")) as { version: string };
		expect(pkg.version).toBe("1.9.0");
	});

	it("LSA-DOC198: README core and status badges 1.9.0 brightgreen", () => {
		const readme = read("README.md");
		expect(readme).toContain("core-1.9.0-brightgreen");
		expect(readme).toContain("status-stable_1.9.0-brightgreen");
	});
});
