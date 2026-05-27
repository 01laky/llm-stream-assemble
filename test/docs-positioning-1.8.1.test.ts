import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(path: string): string {
	return readFileSync(join(rootDir, path), "utf8");
}

describe("docs positioning 1.8.1", () => {
	it("LSA-DOC174: README badges reference 1.8.1 and test count badge", () => {
		const readme = read("README.md");
		expect(readme).toContain("core-1.8.1-brightgreen");
		expect(readme).toMatch(/Stable `1\.8\.1`/);
		expect(readme).toMatch(/tests-(?:TBD|\d+)_passing/);
	});

	it("LSA-DOC175: CHANGELOG 1.8.1 section exists", () => {
		expect(read("CHANGELOG.md")).toContain("## [1.8.1]");
	});

	it("LSA-DOC176: package.json version is 1.8.1", () => {
		const pkg = JSON.parse(read("package.json")) as { version: string };
		expect(pkg.version).toBe("1.8.1");
	});

	it("LSA-DOC177: compatibility.md stable status is 1.8.1", () => {
		expect(read("docs/compatibility.md")).toMatch(/Stable `1\.8\.1`/);
	});

	it("LSA-DOC178: adapters-overview stable label is 1.8.1", () => {
		expect(read("docs/img/adapters-overview.mmd")).toContain("1.8.1");
	});

	it("LSA-DOC179: README stable green badges are 1.8.1 not beta", () => {
		const readme = read("README.md");
		expect(readme).toContain("status-stable_1.8.1-brightgreen");
		expect(readme).toContain("core-1.8.1-brightgreen");
		expect(readme).not.toMatch(/status-beta_|status-pre_|_rc-orange|_beta-yellow/i);
		expect(readme).not.toContain("core-1.8.1-blue");
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
