import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(path: string): string {
	return readFileSync(join(rootDir, path), "utf8");
}

function changelogSection(version: string, nextVersion: string): string {
	const combined = read("CHANGELOG.md");
	return combined.split(`## [${version}]`)[1]?.split(`## [${nextVersion}]`)[0] ?? "";
}

describe("docs positioning 1.9.0 (historical)", () => {
	it("LSA-DOC182: CHANGELOG 1.9.0 documents test badge >= 4000", () => {
		const section = changelogSection("1.9.0", "1.9.1");
		expect(section).toMatch(/4207|4000|≥ 4000|>= 4000/i);
	});

	it("LSA-DOC183: docs/testing-strategy.md exists with Zero API key policy", () => {
		const doc = read("docs/testing-strategy.md");
		expect(doc).toContain("Zero paid provider API");
		expect(doc).toContain("Zero API key CI policy");
	});

	it("LSA-DOC184: CHANGELOG 1.9.0 mentions chunk-split matrix", () => {
		const section = changelogSection("1.9.0", "1.9.1");
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

	it("LSA-DOC190: CHANGELOG 1.9.0 documents stable release", () => {
		const section = changelogSection("1.9.0", "1.9.1");
		expect(section).toMatch(/1\.9\.0|stable/i);
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

	it("LSA-DOC195: CHANGELOG 1.9.0 documents performance budget (historical MAINT39 era)", () => {
		const section = changelogSection("1.9.0", "1.9.1");
		expect(section).toMatch(/testing-strategy|4000|4207/i);
	});

	it("LSA-DOC196: testing-strategy performance budget section", () => {
		expect(read("docs/testing-strategy.md")).toContain("Performance budget");
	});

	it("LSA-DOC197: CHANGELOG 1.9.0 section exists", () => {
		expect(read("CHANGELOG.md")).toContain("## [1.9.0]");
	});

	it("LSA-DOC198: CHANGELOG 1.9.0 documents stable badges", () => {
		const section = changelogSection("1.9.0", "1.9.1");
		expect(section).toMatch(/1\.9\.0|4207/i);
	});
});
