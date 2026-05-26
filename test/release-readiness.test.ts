import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(path: string): string {
	return readFileSync(join(rootDir, path), "utf8");
}

describe("release readiness", () => {
	it("LSA-REL01: package exports OpenAI Responses subpath", () => {
		const pkg = JSON.parse(read("package.json")) as { exports: Record<string, unknown> };
		expect(pkg.exports["./adapters/openai-responses"]).toBeDefined();
	});

	it("LSA-REL02: tsup config builds OpenAI Responses subpath", () => {
		expect(read("tsup.config.ts")).toContain('"adapters/openai-responses"');
	});

	it("LSA-REL03: dist OpenAI Responses artifacts exist", () => {
		for (const file of [
			"dist/adapters/openai-responses.d.ts",
			"dist/adapters/openai-responses.d.cts",
			"dist/adapters/openai-responses.js",
			"dist/adapters/openai-responses.cjs",
		]) {
			expect(existsSync(join(rootDir, file))).toBe(true);
		}
	});

	it("LSA-REL04: README has Install section", () => {
		expect(read("README.md")).toContain("## Install");
	});

	it("LSA-REL05: README has Quickstart section", () => {
		expect(read("README.md")).toContain("## Quickstart");
	});

	it("LSA-REL06: README has Non-goals section", () => {
		expect(read("README.md")).toContain("## Non-goals");
	});

	it("LSA-REL07: README stable status matches package.json version", () => {
		const pkg = JSON.parse(read("package.json")) as { version: string };
		expect(read("README.md")).toContain(`Stable \`${pkg.version}\``);
	});

	it("LSA-REL08: README mentions publish-facing GitHub description", () => {
		expect(read("README.md")).toContain("A zero-dependency TypeScript layer");
	});

	it("LSA-REL09: adapter guide status is not stale Phase 2 wording", () => {
		expect(read("docs/adapter-guide.md")).toContain("Active guide");
		expect(read("docs/adapter-guide.md")).not.toContain("Phase 2");
	});

	it("LSA-REL10: proposal notes historical status", () => {
		expect(read("docs/proposal.md")).toContain("historical");
	});

	it("LSA-REL11: npm pack dry-run includes dist README and LICENSE", () => {
		const output = execFileSync("npm", ["pack", "--dry-run", "--json"], {
			cwd: rootDir,
			encoding: "utf8",
		});
		const [pack] = JSON.parse(output) as Array<{ files: Array<{ path: string }> }>;
		const files = pack.files.map((file) => file.path);
		expect(files).toContain("dist/index.js");
		expect(files).toContain("README.md");
		expect(files).toContain("LICENSE");
	}, 30_000);

	it("LSA-REL12: package smoke script exists", () => {
		const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
		expect(pkg.scripts["smoke:package"]).toBe("node scripts/smoke-package.mjs");
	});

	it("LSA-REL13: package runtime dependencies remain empty", () => {
		const pkg = JSON.parse(read("package.json")) as { dependencies?: Record<string, string> };
		expect(Object.keys(pkg.dependencies ?? {})).toEqual([]);
	});

	it("LSA-REL14: package exports Gemini subpath", () => {
		const pkg = JSON.parse(read("package.json")) as { exports: Record<string, unknown> };
		expect(pkg.exports["./adapters/gemini"]).toBeDefined();
	});

	it("LSA-REL15: tsup config builds Gemini subpath", () => {
		expect(read("tsup.config.ts")).toContain('"adapters/gemini"');
	});

	it("LSA-REL16: dist Gemini artifacts exist", () => {
		for (const file of [
			"dist/adapters/gemini.d.ts",
			"dist/adapters/gemini.d.cts",
			"dist/adapters/gemini.js",
			"dist/adapters/gemini.cjs",
		]) {
			expect(existsSync(join(rootDir, file))).toBe(true);
		}
	});
});
