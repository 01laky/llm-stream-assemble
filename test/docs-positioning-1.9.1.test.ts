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

describe("docs positioning 1.9.1", () => {
	it("LSA-DOC199: README badges reference 1.9.1 and test count badge", () => {
		const readme = read("README.md");
		expect(readme).toContain("core-1.9.1-brightgreen");
		expect(readme).toMatch(/Stable `1\.9\.1`/);
		expect(readme).toMatch(/tests-(?:TBD|\d+)_passing/);
	});

	it("LSA-DOC200: CHANGELOG 1.9.1 section exists", () => {
		expect(read("CHANGELOG.md")).toContain("## [1.9.1]");
	});

	it("LSA-DOC201: CHANGELOG 1.9.1 mentions Gemini grounding-metadata fixture fix", () => {
		const section = changelogSection("1.9.1", "1.9.0");
		expect(section).toMatch(/grounding-metadata|Gemini.*fixture/i);
	});

	it("LSA-DOC202: package.json version is 1.9.1", () => {
		const pkg = JSON.parse(read("package.json")) as { version: string };
		expect(pkg.version).toBe("1.9.1");
	});

	it("LSA-DOC203: compatibility.md stable status is 1.9.1", () => {
		expect(read("docs/compatibility.md")).toMatch(/Stable `1\.9\.1`/);
	});

	it("LSA-DOC204: adapters-overview stable label is 1.9.1", () => {
		expect(read("docs/img/adapters-overview.mmd")).toContain("1.9.1");
	});

	it("LSA-DOC205: README stable green badges are 1.9.1 not beta", () => {
		const readme = read("README.md");
		expect(readme).toContain("status-stable_1.9.1-brightgreen");
		expect(readme).toContain("core-1.9.1-brightgreen");
		expect(readme).not.toMatch(/status-beta_|status-pre_|_rc-orange|_beta-yellow/i);
		expect(readme).not.toContain("core-1.9.1-blue");
	});

	it("LSA-DOC206: .prettierignore excludes fixture expected.json from formatting", () => {
		expect(read(".prettierignore")).toContain("test/fixtures/**/*.expected.json");
	});
});
