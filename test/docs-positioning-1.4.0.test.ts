import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(path: string): string {
	return readFileSync(join(rootDir, path), "utf8");
}

describe("docs positioning 1.4.0 bedrock", () => {
	it("LSA-DOC51: CHANGELOG documents 1.4.0 Bedrock release", () => {
		const changelog = read("CHANGELOG.md") + read("CHANGELOG-archive.md");
		expect(changelog).toContain("## [1.4.0]");
		expect(changelog).toContain("bedrockAdapter");
	});

	it("LSA-DOC52: adapters-overview.mmd/svg contains bedrockAdapter", () => {
		const mmd = read("docs/img/adapters-overview.mmd");
		expect(mmd).toContain("bedrockAdapter");
		expect(existsSync(join(rootDir, "docs/img/adapters-overview.svg"))).toBe(true);
		expect(read("docs/img/adapters-overview.svg")).toContain("bedrockAdapter");
	});

	it("LSA-DOC53: post-1.0 roadmap marks 1.4.0 Bedrock shipped", () => {
		const roadmap = read("docs/post-1.0-provider-roadmap.md");
		expect(roadmap).toMatch(/1\.4\.0.*✅|1\.4\.0.*shipped|Bedrock.*1\.4\.0/i);
	});

	it("LSA-DOC54: test/fixtures/bedrock/README.md exists with provenance table", () => {
		const fixtureReadme = read("test/fixtures/bedrock/README.md");
		expect(fixtureReadme).toMatch(/provenance|source/i);
		expect(fixtureReadme).toContain("|");
	});

	it("LSA-DOC55: README mentions Bedrock or six built-in adapters", () => {
		const readme = read("README.md");
		expect(readme).toMatch(/bedrockAdapter|six built-in|6 built-in/i);
	});

	it("LSA-DOC56: FAQ headings include Bedrock signing/decode question", () => {
		expect(read("docs/faq.md")).toMatch(
			/Does this library handle AWS signing or EventStream decoding for Bedrock/i,
		);
	});

	it("LSA-DOC57: integration-cookbook.md references bedrock-worker-proxy.ts", () => {
		expect(read("docs/integration-cookbook.md")).toContain("bedrock-worker-proxy.ts");
	});

	it("LSA-DOC58: live-smoke.md contains Bedrock Converse section", () => {
		expect(read("docs/live-smoke.md")).toMatch(/Bedrock Converse|smoke:bedrock/i);
	});

	it("LSA-DOC59: architecture SVGs include Bedrock paths where providers are routed", () => {
		for (const svg of [
			"docs/img/pipeline.svg",
			"docs/img/quick-decision.svg",
			"docs/img/chunk-assembly.svg",
			"docs/img/assembler-lifecycle.svg",
			"docs/img/transforms.svg",
		]) {
			expect(read(svg)).toMatch(/Bedrock|bedrockAdapter|EventStream|assembleFromPayloads/);
		}
	});
});
