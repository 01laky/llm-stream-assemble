import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(path: string): string {
	return readFileSync(join(rootDir, path), "utf8");
}

function changelogSection(version: string, nextVersion: string): string {
	const archive = read("CHANGELOG.md");
	return archive.split(`## [${version}]`)[1]?.split(`## [${nextVersion}]`)[0] ?? "";
}

describe("docs positioning 1.10.0 (frozen)", () => {
	it("LSA-DOC207: CHANGELOG 1.10.0 documents test badge >= 6000", () => {
		const section = changelogSection("1.10.0", "1.9.1");
		expect(section).toMatch(/6620|6000/);
	});

	it("LSA-DOC209: CHANGELOG 1.10.0 mentions edge-case catalog or exhaustive matrix", () => {
		const section = changelogSection("1.10.0", "1.9.1");
		expect(section).toMatch(/edge-catalog|evil-offset|exhaustive|parse-chunk atom/i);
	});

	it("LSA-DOC213: CHANGELOG 1.10.0 documents Stable 1.10.0 badges", () => {
		const section = changelogSection("1.10.0", "1.9.1");
		expect(section).toMatch(/1\.10\.0|6620/);
	});

	it("LSA-DOC214: CHANGELOG archive contains 1.10.0 section", () => {
		expect(read("CHANGELOG.md")).toContain("## [1.10.0]");
	});

	it("LSA-DOC215: CHANGELOG 1.10.0 documents REL33 / duration gates", () => {
		const section = changelogSection("1.10.0", "1.9.1");
		expect(section).toMatch(/6000|MAINT43|MAINT49|testing-strategy/i);
	});

	it("LSA-DOC222: TH31 evil-offset gate + MAINT41 parse-response gate exist", () => {
		expect(read("test/chunk-split-evil-full.test.ts")).toContain("LSA-TH31");
		expect(read("test/maintenance-hardening.test.ts")).toContain("LSA-MAINT41");
		expect(read("test/parse-response-chunk-matrix.test.ts")).toContain("LSA-TH121");
	});

	it("LSA-DOC223: TH141 REL33 gate + MAINT49 mapper gate exist", () => {
		expect(read("test/maintenance-hardening.test.ts")).toContain("LSA-TH141");
		expect(read("test/maintenance-hardening.test.ts")).toContain("LSA-MAINT49");
	});
});
