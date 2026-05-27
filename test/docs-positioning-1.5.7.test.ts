import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { findDuplicateLsaIds } from "./helpers/lsa-id-audit";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(path: string): string {
	return readFileSync(join(rootDir, path), "utf8");
}

describe("docs positioning 1.5.7", () => {
	it("LSA-DOC97: docs/edge-cases.md references LSA-OC234 and post-finish LSA-X64", () => {
		const doc = read("docs/edge-cases.md");
		expect(doc).toContain("LSA-OC234");
		expect(doc).toContain("LSA-X64");
	});

	it("LSA-DOC98: docs/live-smoke.md documents pnpm smoke:gemini", () => {
		expect(read("docs/live-smoke.md")).toContain("pnpm smoke:gemini");
	});

	it("LSA-DOC99: gemini edge cases use renumbered G86–G90 not conflicting G64–G71", () => {
		const edge = read("test/gemini-edge-cases.test.ts");
		expect(edge).toContain("LSA-G86");
		expect(edge).toContain("LSA-G90");
		expect(edge).not.toMatch(/it\("LSA-G6[4-7]/);
		expect(edge).not.toMatch(/it\("LSA-G7[01]/);
		const duplicates = findDuplicateLsaIds(join(rootDir, "test")).filter(({ id }) =>
			/^LSA-G(?:6[4-9]|7[01])$/.test(id),
		);
		expect(duplicates).toEqual([]);
	});

	it("LSA-DOC100: README contains Runtimes with Node 18+", () => {
		const readme = read("README.md");
		expect(readme).toMatch(/## Runtimes/i);
		expect(readme).toMatch(/Node(\.js)?\s*18\+/i);
	});

	it("LSA-DOC101: CHANGELOG contains 1.5.7 release section", () => {
		const changelog = read("CHANGELOG.md");
		expect(changelog).toContain("## [1.5.7]");
		expect(changelog).toMatch(/smoke:gemini|openai-chat-conformance|MAINT22/i);
	});

	it("LSA-DOC102: CHANGELOG 1.5.7 section remains for historical traceability", () => {
		expect(read("CHANGELOG.md")).toContain("## [1.5.7]");
	});

	it("LSA-DOC103: README and CHANGELOG still reference 1.5.7 release history", () => {
		const readme = read("README.md");
		const changelog = read("CHANGELOG.md");
		expect(changelog).toContain("## [1.5.7]");
		expect(readme).toMatch(/1\.5\.7|CHANGELOG/i);
	});

	it("LSA-DOC105: docs/live-smoke.md has smoke command index with smoke:gemini", () => {
		const doc = read("docs/live-smoke.md");
		expect(doc).toMatch(/Smoke command index|smoke command index/i);
		expect(doc).toContain("smoke:gemini");
		expect(doc).toContain("smoke:vertex");
		expect(doc).toContain("smoke:cohere");
	});

	it("LSA-DOC106: examples/README.md documents pnpm smoke:gemini", () => {
		const doc = read("examples/README.md");
		expect(doc).toContain("pnpm smoke:gemini");
		expect(doc).toContain("docs/live-smoke.md");
	});

	it("LSA-DOC107: docs/edge-cases.md §G version stamp mentions 1.5.6 and 1.5.7 edge work", () => {
		const doc = read("docs/edge-cases.md");
		expect(doc).toMatch(/1\.5\.6/);
		expect(doc).toMatch(/1\.5\.7/);
		expect(doc).toMatch(/G86|renumber/i);
	});

	it("LSA-DOC108: roadmap Gemini test ranges are broken down beyond flat G01–G71 only", () => {
		const doc = read("docs/post-1.0-provider-roadmap.md");
		expect(doc).toMatch(/conformance|docs-regression|G86|GV01/i);
	});

	it("LSA-DOC109: README tests badge matches release-prep enforcement pattern", () => {
		const readme = read("README.md");
		const releasePrep = read("scripts/release-prep.mjs");
		const badgeMatch = readme.match(/tests-(\d+)_passing/);
		expect(badgeMatch).not.toBeNull();
		expect(releasePrep).toMatch(/tests-\(\\d\+\)_passing|readmeTestsBadgeCount/i);
		expect(Number(badgeMatch?.[1])).toBeGreaterThanOrEqual(1799);
	});
});
