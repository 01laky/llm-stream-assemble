import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(path: string): string {
	return readFileSync(join(rootDir, path), "utf8");
}

describe("docs positioning 1.10.0", () => {
	it("LSA-DOC207: README test badge >= 6000", () => {
		const readme = read("README.md");
		const match = readme.match(/tests-(\d+)_passing/);
		expect(match).not.toBeNull();
		expect(Number(match![1])).toBeGreaterThanOrEqual(6000);
	});

	it("LSA-DOC208: docs/edge-cases.md references edge-catalog", () => {
		expect(read("docs/edge-cases.md")).toMatch(/edge-catalog|EC01|EC72/i);
	});

	it("LSA-DOC209: CHANGELOG 1.10.0 mentions edge-case catalog or exhaustive matrix", () => {
		const section = read("CHANGELOG.md").split("## [1.10.0]")[1]?.split("## [1.9.1]")[0] ?? "";
		expect(section).toMatch(/edge-catalog|evil-offset|exhaustive|parse-chunk atom/i);
	});

	it("LSA-DOC210: test/fixtures/edge-catalog/README.md exists", () => {
		expect(read("test/fixtures/edge-catalog/README.md")).toContain("Edge catalog mapping");
	});

	it("LSA-DOC211: edge-catalog-matrix.test.ts exists", () => {
		expect(read("test/edge-catalog-matrix.test.ts")).toContain("LSA-EC01");
	});

	it("LSA-DOC212: parse-chunk-atom-matrix.test.ts exists", () => {
		expect(read("test/parse-chunk-atom-matrix.test.ts")).toContain("PC01:");
	});

	it("LSA-DOC213: README Stable 1.10.0", () => {
		expect(read("README.md")).toMatch(/Stable `1\.10\.0`/);
		expect(read("README.md")).toContain("core-1.10.0-brightgreen");
	});

	it("LSA-DOC214: package.json version 1.10.0", () => {
		const pkg = JSON.parse(read("package.json")) as { version: string };
		expect(pkg.version).toBe("1.10.0");
	});

	it("LSA-DOC215: testing-strategy documents 6000 gate + MAINT43 duration", () => {
		const doc = read("docs/testing-strategy.md");
		expect(doc).toMatch(/6000|6,?000/);
		expect(doc).toMatch(/90s|75s|MAINT43/i);
	});

	it("LSA-DOC216: testing-strategy documents full tier-1 evil-offset policy", () => {
		expect(read("docs/testing-strategy.md")).toMatch(/evil-offset|chunk-split-evil-full|TH31/i);
	});

	it("LSA-DOC217: testing-strategy documents MAINT48 edge-cases audit", () => {
		expect(read("docs/testing-strategy.md")).toMatch(/MAINT48|audit-edge-cases-catalog/i);
	});

	it("LSA-DOC218: adapter-options-matrix.test.ts or OPT01 anchor exists", () => {
		expect(read("test/adapter-options-matrix.test.ts")).toContain("LSA-OPT01");
	});

	it("LSA-DOC219: finish-trailing-event-matrix.test.ts or X311 anchor exists", () => {
		expect(read("test/finish-trailing-event-matrix.test.ts")).toContain("LSA-X311");
	});

	it("LSA-DOC220: scripts/audit-edge-cases-catalog.ts in verify", () => {
		const pkg = JSON.parse(read("package.json")) as { scripts?: Record<string, string> };
		expect(pkg.scripts?.verify).toContain("audit-edge-cases-catalog");
	});

	it("LSA-DOC221: TH31 evil-offset full matrix gate exists", () => {
		expect(read("test/chunk-split-evil-full.test.ts")).toContain("LSA-TH31");
	});

	it("LSA-DOC222: MAINT41 evil-offset coverage gate exists", () => {
		expect(read("test/maintenance-hardening.test.ts")).toContain("LSA-MAINT41");
	});

	it("LSA-DOC223: MAINT49 per-file performance gate exists", () => {
		expect(read("test/maintenance-hardening.test.ts")).toContain("LSA-MAINT49");
	});

	it("LSA-DOC224: SD01 deterministic seed grid gate exists", () => {
		expect(read("test/deterministic-seed-matrix.test.ts")).toContain("LSA-SD01");
	});

	it("LSA-DOC225: RP31 AI SDK mapper gate exists", () => {
		expect(read("test/ai-sdk-mapper-exhaustive.test.ts")).toContain("LSA-RP31");
	});
});
