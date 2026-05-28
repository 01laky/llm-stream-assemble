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

describe("docs positioning 1.8.1 (historical)", () => {
	it("LSA-DOC174: CHANGELOG 1.8.1 documents README badge and stable release", () => {
		const section = changelogSection("1.8.1", "1.8.0");
		expect(section).toMatch(/2136|test badge \*\*2136\*\*/);
		expect(section).toMatch(/1\.8\.1/);
	});

	it("LSA-DOC175: CHANGELOG 1.8.1 section exists", () => {
		expect(read("CHANGELOG.md")).toContain("## [1.8.1]");
	});

	it("LSA-DOC176: CHANGELOG 1.8.1 documents patch release metadata", () => {
		const section = changelogSection("1.8.1", "1.8.0");
		expect(section).toMatch(/1\.8\.1/);
		expect(section).toMatch(/2136|patch/i);
	});

	it("LSA-DOC177: CHANGELOG 1.8.1 documents compatibility stable label", () => {
		const section = changelogSection("1.8.1", "1.8.0");
		expect(section).toMatch(/Version labels \*\*1\.8\.1\*\*|stable \*\*1\.8\.1\*\*/i);
	});

	it("LSA-DOC178: CHANGELOG 1.8.1 documents adapters-overview stable 1.8.1", () => {
		const section = changelogSection("1.8.1", "1.8.0");
		expect(section).toMatch(/adapters-overview.*1\.8\.1|1\.8\.1.*adapters-overview/i);
	});

	it("LSA-DOC179: CHANGELOG 1.8.1 documents stable green badges", () => {
		const section = changelogSection("1.8.1", "1.8.0");
		expect(section).toContain("core-1.8.1-brightgreen");
		expect(section).toContain("status-stable_1.8.1-brightgreen");
	});

	it("LSA-DOC180: docs-positioning-1.8.0 pins historical 1.8.0 metadata", () => {
		const historical = read("test/docs-positioning-1.8.0.test.ts");
		expect(historical).toContain("LSA-DOC151");
		expect(historical).toMatch(/1\.8\.0/);
		expect(historical).toMatch(/2128|historical/i);
	});

	it("LSA-DOC181: docs-positioning-1.8.0 no longer asserts package.json version 1.8.0", () => {
		const historical = read("test/docs-positioning-1.8.0.test.ts");
		expect(historical).not.toMatch(/pkg\.version.*1\.8\.0/);
	});
});
