import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(path: string): string {
	return readFileSync(join(rootDir, path), "utf8");
}

function changelogSection(version: string, nextVersion: string): string {
	return read("CHANGELOG.md").split(`## [${version}]`)[1]?.split(`## [${nextVersion}]`)[0] ?? "";
}

describe("docs positioning 1.9.1 (historical)", () => {
	it("LSA-DOC199: CHANGELOG 1.9.1 documents Gemini grounding-metadata fixture fix", () => {
		const section = changelogSection("1.9.1", "1.9.0");
		expect(section).toMatch(/grounding-metadata|Gemini.*fixture/i);
	});

	it("LSA-DOC200: CHANGELOG 1.9.1 section exists", () => {
		expect(read("CHANGELOG.md")).toContain("## [1.9.1]");
	});

	it("LSA-DOC201: CHANGELOG 1.9.1 mentions prettierignore for expected.json", () => {
		const section = changelogSection("1.9.1", "1.9.0");
		expect(section).toMatch(/prettierignore|\.expected\.json/i);
	});

	it("LSA-DOC202: CHANGELOG 1.9.1 documents patch semver-safe note", () => {
		const section = changelogSection("1.9.1", "1.9.0");
		expect(section).toMatch(/1\.9\.0|semver-safe|patch/i);
	});

	it("LSA-DOC203: CHANGELOG 1.9.1 documents DOC199-DOC206 positioning", () => {
		const section = changelogSection("1.9.1", "1.9.0");
		expect(section).toMatch(/DOC199|1\.9\.1/);
	});

	it("LSA-DOC204: CHANGELOG 1.9.1 mentions responses logprobs drift fix", () => {
		const section = changelogSection("1.9.1", "1.9.0");
		expect(section).toMatch(/responses-logprobs|logprobs/i);
	});

	it("LSA-DOC205: CHANGELOG 1.9.1 stable badge references", () => {
		const section = changelogSection("1.9.1", "1.9.0");
		expect(section).toMatch(/1\.9\.1|badge/i);
	});

	it("LSA-DOC206: .prettierignore excludes fixture expected.json from formatting", () => {
		expect(read(".prettierignore")).toContain("test/fixtures/**/*.expected.json");
	});
});
