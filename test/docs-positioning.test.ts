import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(path: string): string {
	return readFileSync(join(rootDir, path), "utf8");
}

function changelogSection(version: string, nextVersion: string): string {
	const combined = read("CHANGELOG.md") + read("CHANGELOG-archive.md");
	return combined.split(`## [${version}]`)[1]?.split(`## [${nextVersion}]`)[0] ?? "";
}

describe("docs positioning 1.10.2 (active)", () => {
	it("LSA-DOC238: README Stable 1.10.2 and test badge >= 6620", () => {
		const readme = read("README.md");
		expect(readme).toMatch(/Stable `1\.10\.2`/);
		expect(readme).toContain("core-1.10.2-brightgreen");
		const match = readme.match(/tests-(\d+)_passing/);
		expect(match).not.toBeNull();
		expect(Number(match![1])).toBeGreaterThanOrEqual(6620);
	});

	it("LSA-DOC239: package.json version 1.10.2", () => {
		const pkg = JSON.parse(read("package.json")) as { version: string };
		expect(pkg.version).toBe("1.10.2");
	});

	it("LSA-DOC240: CHANGELOG 1.10.2 documents EC73–EC88 edge catalog expansion", () => {
		const section = changelogSection("1.10.2", "1.10.1");
		expect(section).toMatch(/EC7[3-9]|EC8[0-8]|edge-catalog/i);
	});

	it("LSA-DOC241: assembly-session-edge test suite exists", () => {
		expect(read("test/assembly-session-edge.test.ts")).toContain("LSA-AS01");
	});

	it("LSA-DOC242: edge-catalog-extended-matrix covers EC73+ evil-offset", () => {
		expect(read("test/edge-catalog-extended-matrix.test.ts")).toContain("LSA-EC88");
	});

	it("LSA-DOC243: edge catalog MAINT44 gate requires >= 88 fixtures", () => {
		expect(read("test/edge-catalog-matrix.test.ts")).toMatch(/MAINT44.*88|>= 88/);
	});

	it("LSA-DOC244: testing-strategy status 1.10.2", () => {
		expect(read("docs/testing-strategy.md")).toContain("1.10.2");
	});

	it("LSA-DOC245: manifest infer fixes for cohere jsonl and ec15/ec70 routing", () => {
		const script = read("scripts/generate-edge-catalog-fixtures.mjs");
		expect(script).toContain("needsJsonMode");
		expect(script).toContain("MANIFEST_OVERRIDES");
	});
});
