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

describe("docs positioning 1.10.1 (frozen)", () => {
	it("LSA-DOC226: CHANGELOG 1.10.1 documents AssemblySession refactor", () => {
		const section = changelogSection("1.10.1", "1.10.0");
		expect(section).toMatch(/AssemblySession|hardening-registry|common/i);
	});

	it("LSA-DOC227: CHANGELOG 1.10.1 documents REL33 6620 floor", () => {
		const section = changelogSection("1.10.1", "1.10.0");
		expect(section).toMatch(/6620|6624/);
	});

	it("LSA-DOC228: CHANGELOG archive contains 1.10.0 section", () => {
		expect(read("CHANGELOG.md")).toContain("## [1.10.0]");
	});

	it("LSA-DOC229: hardening-registry.json exists with MAINT43 and MAINT51", () => {
		const registry = read("test/hardening-registry.json");
		expect(registry).toContain("MAINT43");
		expect(registry).toContain("MAINT51");
	});

	it("LSA-DOC230: export smoke gate EXP01 exists", () => {
		expect(read("test/export-smoke.test.ts")).toContain("LSA-EXP01");
	});

	it("LSA-DOC231: matrix-runner helper exists", () => {
		expect(read("test/helpers/matrix-runner.ts")).toContain("defineGoldenMatrix");
	});

	it("LSA-DOC232: adapters split into module folders", () => {
		expect(read("src/adapters/cohere/index.ts")).toContain("cohereAdapter");
		expect(read("src/adapters/bedrock/index.ts")).toContain("bedrockAdapter");
	});

	it("LSA-DOC233: common adapter modules (renamed from shared)", () => {
		expect(read("src/adapters/common/parse-payload.ts")).toBeTruthy();
	});

	it("LSA-DOC234: test-id-migration doc linked from testing-strategy", () => {
		expect(read("docs/testing-strategy.md")).toContain("test-id-migration.md");
	});

	it("LSA-DOC235: CHANGELOG 1.10.1 documents docs hygiene policy", () => {
		const section = changelogSection("1.10.1", "1.10.0");
		expect(section).toMatch(/\.cursor\/rules|docs sync|test-id-migration/i);
	});

	it("LSA-DOC236: examples vs matrix E2E policy documented", () => {
		expect(read("docs/testing-strategy.md")).toMatch(/Examples vs matrix E2E/i);
	});

	it("LSA-DOC237: vitest unit/matrix projects configured", () => {
		expect(read("vitest.config.ts")).toMatch(/matrix|unit/);
	});
});
