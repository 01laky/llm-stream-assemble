import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(path: string): string {
	return readFileSync(join(rootDir, path), "utf8");
}

describe("docs positioning 1.4.1 refactor", () => {
	it("LSA-DOC60: README badges reference 1.4.1 and 1177 tests", () => {
		const readme = read("README.md");
		expect(readme).toContain("1.4.1");
		expect(readme).toContain("1183");
		expect(readme).toContain("Stable `1.4.1`");
	});

	it("LSA-DOC61: CHANGELOG contains 1.4.1 shared adapters section", () => {
		const changelog = read("CHANGELOG.md");
		expect(changelog).toContain("## [1.4.1]");
		expect(changelog).toContain("src/adapters/shared/");
	});

	it("LSA-DOC62: adapter-guide documents shared internal modules", () => {
		const guide = read("docs/adapter-guide.md");
		expect(guide).toContain("Shared internal modules");
		expect(guide).toContain("shared/parse-payload.ts");
		expect(guide).toContain("shared/incremental-json.ts");
	});

	it("LSA-DOC63: package.json version is 1.4.1", () => {
		const pkg = JSON.parse(read("package.json")) as { version: string };
		expect(pkg.version).toBe("1.4.1");
	});

	it("LSA-DOC64: adapters-overview stable label is 1.4.1", () => {
		expect(read("docs/img/adapters-overview.mmd")).toContain("1.4.1");
		expect(existsSync(join(rootDir, "docs/img/adapters-overview.svg"))).toBe(true);
	});
});
