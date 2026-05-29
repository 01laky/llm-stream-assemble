import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("transforms docs regression", () => {
	it("LSA-T39: README documents collectStream", () => {
		const readme =
			readFileSync(join(rootDir, "README.md"), "utf8") +
			readFileSync(join(rootDir, "docs/usage-guides.md"), "utf8") +
			readFileSync(join(rootDir, "examples/README.md"), "utf8") +
			readFileSync(join(rootDir, "CHANGELOG-archive.md"), "utf8");
		expect(readme).toContain("collectStream");
		expect(readme).toContain("Collecting a Stream");
	});

	it("LSA-T40: README documents tapEvents", () => {
		const readme =
			readFileSync(join(rootDir, "README.md"), "utf8") +
			readFileSync(join(rootDir, "docs/usage-guides.md"), "utf8") +
			readFileSync(join(rootDir, "examples/README.md"), "utf8") +
			readFileSync(join(rootDir, "CHANGELOG-archive.md"), "utf8");
		expect(readme).toContain("tapEvents");
		expect(readme).toContain("Tapping Events");
	});

	it("LSA-T41: README documents toSSE and error sanitization", () => {
		const readme =
			readFileSync(join(rootDir, "README.md"), "utf8") +
			readFileSync(join(rootDir, "docs/usage-guides.md"), "utf8") +
			readFileSync(join(rootDir, "examples/README.md"), "utf8") +
			readFileSync(join(rootDir, "CHANGELOG-archive.md"), "utf8");
		expect(readme).toContain("toSSE");
		expect(readme).toContain("sanitizeErrors");
	});

	it("LSA-T42: README documents assembleFromFile as Node/dev replay helper", () => {
		const readme =
			readFileSync(join(rootDir, "README.md"), "utf8") +
			readFileSync(join(rootDir, "docs/usage-guides.md"), "utf8") +
			readFileSync(join(rootDir, "examples/README.md"), "utf8") +
			readFileSync(join(rootDir, "CHANGELOG-archive.md"), "utf8");
		expect(readme).toContain("assembleFromFile");
		expect(readme).toContain("Node/dev replay helper");
	});

	it("LSA-T42b: README documents browser/edge bundling note", () => {
		const readme =
			readFileSync(join(rootDir, "README.md"), "utf8") +
			readFileSync(join(rootDir, "docs/usage-guides.md"), "utf8") +
			readFileSync(join(rootDir, "examples/README.md"), "utf8") +
			readFileSync(join(rootDir, "CHANGELOG-archive.md"), "utf8");
		expect(readme).toContain("browser bundles");
		expect(readme).toContain("node:fs/promises");
	});
});
