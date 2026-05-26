import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(path: string): string {
	return readFileSync(join(rootDir, path), "utf8");
}

describe("docs positioning 1.3.5 edge-case showcase", () => {
	const readme = () => read("README.md");

	it("LSA-DOC21: README contains First success in 30 seconds", () => {
		expect(readme()).toContain("First success in 30 seconds");
	});

	it("LSA-DOC22: First success uses assembleStream + openaiChatAdapter; no StreamAssembler", () => {
		const text = readme();
		expect(text).toContain("assembleStream");
		expect(text).toContain("openaiChatAdapter");
		expect(text).not.toContain("StreamAssembler");
	});

	it("LSA-DOC23: README contains += framing for Why not text += chunk", () => {
		expect(readme()).toMatch(/Why not `text \+= chunk`/);
	});

	it("LSA-DOC24: docs/edge-cases.md exists and mentions SSE mid-line or line buffer", () => {
		const doc = read("docs/edge-cases.md");
		expect(existsSync(join(rootDir, "docs/edge-cases.md"))).toBe(true);
		expect(doc).toMatch(/mid-line|line buffer/i);
	});

	it("LSA-DOC25: edge-cases doc mentions tool_call.args.delta or tool JSON partials", () => {
		const doc = read("docs/edge-cases.md");
		expect(doc).toMatch(/tool_call\.args\.delta|tool JSON partial/i);
	});

	it("LSA-DOC26: edge-cases or README states markdown fence / UI layer is non-goal", () => {
		const edgeCases = read("docs/edge-cases.md");
		expect(edgeCases).toMatch(/non-goal|does not parse/i);
	});

	it("LSA-DOC27: README embeds chunk-assembly.svg; build-diagrams lists chunk-assembly.mmd", () => {
		expect(readme()).toContain("chunk-assembly.svg");
		expect(read("scripts/build-diagrams.mjs")).toContain("chunk-assembly.mmd");
	});

	it("LSA-DOC28: README Why use this contains Performance at a glance with zero deps and LSA-C52 or O(n)", () => {
		const text = readme();
		expect(text).toContain("Performance at a glance");
		expect(text).toMatch(/Zero runtime dependencies|zero runtime dependencies/i);
		expect(text).toMatch(/LSA-C52|O\(n\)/);
	});

	it("LSA-DOC29: CHANGELOG contains 1.3.5 and docs/edge-cases.md", () => {
		const changelog = read("CHANGELOG.md");
		expect(changelog).toContain("## [1.3.5]");
		expect(changelog).toContain("docs/edge-cases.md");
	});

	it("LSA-DOC30: README hero contains positioning line with += loop", () => {
		expect(readme()).toContain("not another `+=` loop");
	});

	it("LSA-DOC31: FAQ links or references docs/edge-cases.md", () => {
		expect(read("docs/faq.md")).toContain("docs/edge-cases.md");
	});

	it("LSA-DOC32: docs/edge-cases.md contains DIY vs assembleStream comparison table", () => {
		const doc = read("docs/edge-cases.md");
		expect(doc).toContain("DIY vs `assembleStream`");
		expect(doc).toContain("assembleStream(body, adapter)");
	});

	it("LSA-DOC33: docs/edge-cases.md documents assembleFromFile fixture replay snippet", () => {
		const doc = read("docs/edge-cases.md");
		expect(doc).toContain("assembleFromFile");
		expect(doc).toContain("tool-single.sse");
	});

	it("LSA-DOC34: docs/edge-cases.md cites fixture path and test id", () => {
		const doc = read("docs/edge-cases.md");
		expect(doc).toContain("tool-single.sse");
		expect(doc).toMatch(/LSA-C52|LSA-C04|LSA-C/);
	});
});
