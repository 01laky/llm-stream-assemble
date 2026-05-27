import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(path: string): string {
	return readFileSync(join(rootDir, path), "utf8");
}

describe("bedrock docs regression", () => {
	it("LSA-B27: README contains bedrockAdapter and Bedrock Usage", () => {
		const readme = read("README.md");
		expect(readme).toContain("bedrockAdapter");
		expect(readme).toContain("### Bedrock Usage");
	});

	it("LSA-B28: compatibility.md contains Bedrock row and bedrockAdapter", () => {
		const compatibility = read("docs/compatibility.md");
		expect(compatibility).toContain("bedrockAdapter");
		expect(compatibility).toMatch(/AWS Bedrock|Bedrock \(Converse/);
	});

	it("LSA-B29: adapter-guide mentions EventStream decode boundary", () => {
		expect(read("docs/adapter-guide.md")).toMatch(/decode boundary|EventStream decode/i);
	});

	it("LSA-B30: CHANGELOG contains 1.4.0 and bedrock", () => {
		const changelog = read("CHANGELOG.md");
		expect(changelog).toContain("## [1.4.0]");
		expect(changelog.toLowerCase()).toContain("bedrock");
	});

	it("LSA-B31: package.json version is 1.5.7", () => {
		const pkg = JSON.parse(read("package.json")) as { version: string };
		expect(pkg.version).toBe("1.5.7");
	});

	it("LSA-B32: examples/bedrock/README.md exists and mentions decode", () => {
		expect(existsSync(join(rootDir, "examples/bedrock/README.md"))).toBe(true);
		expect(read("examples/bedrock/README.md")).toMatch(/decode|EventStream/i);
	});

	it("LSA-B33: .env.example contains BEDROCK_MODEL_ID", () => {
		expect(read(".env.example")).toContain("BEDROCK_MODEL_ID");
	});

	it("LSA-B36: package.json scripts include smoke:bedrock", () => {
		const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
		expect(pkg.scripts["smoke:bedrock"]).toBe("node scripts/live-smoke/bedrock-converse.mjs");
	});

	it("LSA-B37: docs/live-smoke.md documents Bedrock smoke and env vars", () => {
		const liveSmoke = read("docs/live-smoke.md");
		expect(liveSmoke).toMatch(/Bedrock|bedrock/i);
		expect(liveSmoke).toContain("AWS_REGION");
		expect(liveSmoke).toContain("BEDROCK_MODEL_ID");
		expect(liveSmoke).toContain("smoke:bedrock");
	});
});
