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
		expect(read("README.md")).toContain("A composable TypeScript layer");
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

	it("LSA-REL17: release prep script is wired in package.json", () => {
		const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
		expect(pkg.scripts["release:prep"]).toBe("node scripts/release-prep.mjs");
		expect(existsSync(join(rootDir, "scripts/release-prep.mjs"))).toBe(true);
	});

	it("LSA-REL18: README examples list covers primary node-fetch samples", () => {
		const readme = read("README.md");
		for (const sample of [
			"examples/node-fetch/openai-chat.ts",
			"examples/node-fetch/openai-compatible.ts",
			"examples/node-fetch/azure-openai.ts",
			"examples/node-fetch/perplexity.ts",
			"examples/node-fetch/xai.ts",
			"examples/node-fetch/gemini.ts",
			"examples/node-fetch/bedrock.ts",
			"examples/node-fetch/cohere.ts",
			"examples/workers-ai/rest-chat-completions.ts",
		]) {
			expect(readme).toContain(sample);
		}
	});

	it("LSA-REL19: README architecture diagrams include pipeline and adapters overview", () => {
		const readme = read("README.md");
		expect(readme).toContain("docs/img/pipeline.svg");
		expect(readme).toContain("docs/img/adapters-overview.svg");
		expect(readme).toContain("docs/img/transforms.svg");
		expect(readme).toContain("geminiAdapter");
		expect(readme).toContain("bedrockAdapter");
		expect(readme).toContain("cohereAdapter");
	});

	it("LSA-REL20: package exports Bedrock subpath", () => {
		const pkg = JSON.parse(read("package.json")) as { exports: Record<string, unknown> };
		expect(pkg.exports["./adapters/bedrock"]).toBeDefined();
	});

	it("LSA-REL21: tsup config builds Bedrock subpath", () => {
		expect(read("tsup.config.ts")).toContain('"adapters/bedrock"');
	});

	it("LSA-REL22: dist Bedrock artifacts exist", () => {
		for (const file of [
			"dist/adapters/bedrock.d.ts",
			"dist/adapters/bedrock.d.cts",
			"dist/adapters/bedrock.js",
			"dist/adapters/bedrock.cjs",
		]) {
			expect(existsSync(join(rootDir, file))).toBe(true);
		}
	});

	it("LSA-REL23: package exports Cohere subpath", () => {
		const pkg = JSON.parse(read("package.json")) as { exports: Record<string, unknown> };
		expect(pkg.exports["./adapters/cohere"]).toBeDefined();
	});

	it("LSA-REL24: tsup config builds Cohere subpath", () => {
		expect(read("tsup.config.ts")).toContain('"adapters/cohere"');
	});

	it("LSA-REL25: dist Cohere artifacts exist", () => {
		for (const file of [
			"dist/adapters/cohere.d.ts",
			"dist/adapters/cohere.d.cts",
			"dist/adapters/cohere.js",
			"dist/adapters/cohere.cjs",
		]) {
			expect(existsSync(join(rootDir, file))).toBe(true);
		}
	});

	it("LSA-REL26: README examples list includes vertex-gemini.ts", () => {
		expect(read("README.md")).toContain("examples/node-fetch/vertex-gemini.ts");
	});

	it("LSA-REL27: package.json scripts include smoke:vertex and fixtures:check-gemini", () => {
		const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
		expect(pkg.scripts["smoke:vertex"]).toBe("node scripts/live-smoke/vertex-gemini.mjs");
		expect(pkg.scripts["fixtures:check-gemini"]).toBeDefined();
	});
});
