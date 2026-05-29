import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(path: string): string {
	return readFileSync(join(rootDir, path), "utf8");
}

describe("cohere docs regression", () => {
	it("LSA-CO27: README contains cohereAdapter and Cohere Usage", () => {
		const readme = read("README.md") + read("docs/usage-guides.md");
		expect(readme).toContain("cohereAdapter");
		expect(readme).toContain("Cohere Usage");
	});

	it("LSA-CO28: compatibility.md contains Cohere row and cohereAdapter", () => {
		const compatibility = read("docs/compatibility.md");
		expect(compatibility).toContain("cohereAdapter");
		expect(compatibility).toMatch(/Cohere|cohere\.com\/v2/i);
	});

	it("LSA-CO29: adapter-guide mentions Cohere v2 streaming events", () => {
		expect(read("docs/adapter-guide.md")).toMatch(/Cohere|tool-plan-delta|citation-start/i);
	});

	it("LSA-CO30: CHANGELOG contains 1.5.0 and cohere", () => {
		const changelog = read("CHANGELOG.md") + read("CHANGELOG-archive.md");
		expect(changelog).toContain("## [1.5.0]");
		expect(changelog.toLowerCase()).toContain("cohere");
	});

	it("LSA-CO31: CHANGELOG 1.5.0 section remains for historical traceability", () => {
		expect(read("CHANGELOG.md") + read("CHANGELOG-archive.md")).toContain("## [1.5.0]");
	});

	it("LSA-CO32: examples/node-fetch/cohere.ts exists and mentions parseSSE", () => {
		expect(existsSync(join(rootDir, "examples/node-fetch/cohere.ts"))).toBe(true);
		expect(read("examples/node-fetch/cohere.ts")).toMatch(/parseSSE|cohereAdapter/);
	});

	it("LSA-CO33: .env.example contains COHERE_API_KEY", () => {
		expect(read(".env.example")).toContain("COHERE_API_KEY");
	});

	it("LSA-CO34: compatibility.md Cohere row status is semver 1.5.0 not v1.5", () => {
		const compatibility = read("docs/compatibility.md");
		expect(compatibility).toContain("| 1.5.0  |");
		expect(compatibility).not.toContain("| v1.5   |");
	});

	it("LSA-CO36: FAQ states Cohere is not OpenAI-compatible", () => {
		const faq = read("docs/faq.md");
		expect(faq).toMatch(/Cohere.*not.*OpenAI-compatible|not OpenAI-compatible.*Cohere/i);
		expect(faq).toContain("cohereAdapter");
	});

	it("LSA-CO35: package.json scripts include smoke:cohere", () => {
		const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
		expect(pkg.scripts["smoke:cohere"]).toBe("node scripts/live-smoke/cohere-chat.mjs");
	});

	it("LSA-CO37: docs/live-smoke.md documents Cohere smoke and env vars", () => {
		const liveSmoke = read("docs/live-smoke.md");
		expect(liveSmoke).toMatch(/Cohere|cohere/i);
		expect(liveSmoke).toContain("COHERE_API_KEY");
		expect(liveSmoke).toContain("smoke:cohere");
	});
});
