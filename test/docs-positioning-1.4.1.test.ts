import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(path: string): string {
	return readFileSync(join(rootDir, path), "utf8");
}

describe("docs positioning 1.4.1 refactor", () => {
	it("LSA-DOC60: README retains 1.4.1 release traceability in CHANGELOG", () => {
		const readme = read("README.md");
		const changelog = read("CHANGELOG.md");
		expect(changelog).toContain("## [1.4.1]");
		expect(readme).toMatch(/CHANGELOG|1\.4\.1/i);
	});

	it("LSA-DOC61: CHANGELOG contains 1.4.1 shared/common adapter section", () => {
		const changelog = read("CHANGELOG.md");
		expect(changelog).toContain("## [1.4.1]");
		expect(changelog).toMatch(/adapters\/(shared|common)\//);
	});

	it("LSA-DOC62: adapter-guide documents common internal modules", () => {
		const guide = read("docs/adapter-guide.md");
		expect(guide).toContain("Shared internal modules");
		expect(guide).toContain("common/parse-payload.ts");
		expect(guide).toContain("common/incremental-json.ts");
	});

	it("LSA-DOC63: CHANGELOG 1.4.1 section remains for historical traceability", () => {
		expect(read("CHANGELOG.md")).toContain("## [1.4.1]");
	});

	it("LSA-DOC64: adapters-overview stable label is 1.10.1", () => {
		expect(read("docs/img/adapters-overview.mmd")).toContain("1.10.1");
		expect(existsSync(join(rootDir, "docs/img/adapters-overview.svg"))).toBe(true);
	});
});
