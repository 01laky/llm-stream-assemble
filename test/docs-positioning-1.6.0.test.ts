import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(path: string): string {
	return readFileSync(join(rootDir, path), "utf8");
}

describe("docs positioning 1.6.0", () => {
	it("LSA-DOC110: historical 1.6.0 release traceability in CHANGELOG and README history", () => {
		const readme = read("README.md");
		const changelog = read("CHANGELOG.md");
		expect(changelog).toContain("## [1.6.0]");
		expect(changelog).toMatch(/tests-1799_passing|README test badge \*\*1799\*\*/);
		expect(readme).toMatch(/1\.6\.0|CHANGELOG/i);
	});

	it("LSA-DOC111: CHANGELOG 1.6.0 mentions citation and grounding", () => {
		const changelog = read("CHANGELOG.md");
		expect(changelog).toContain("## [1.6.0]");
		expect(changelog).toMatch(/citation.*grounding|grounding.*citation/i);
	});

	it("LSA-DOC112: CHANGELOG 1.6.0 section remains for historical traceability", () => {
		expect(read("CHANGELOG.md")).toContain("## [1.6.0]");
	});

	it("LSA-DOC113: compatibility matrix rows updated for Cohere, Perplexity, Gemini", () => {
		const doc = read("docs/compatibility.md");
		expect(doc).toMatch(/Cohere.*citation/i);
		expect(doc).toMatch(/Perplexity.*citation/i);
		expect(doc).toMatch(/groundingMetadata|citationMetadata/i);
	});

	it("LSA-DOC114: adapter-guide documents citation and grounding mapping", () => {
		const doc = read("docs/adapter-guide.md");
		expect(doc).toMatch(/Citation and grounding events/i);
		expect(doc).toContain("citation-start");
		expect(doc).toContain("groundingMetadata");
	});

	it("LSA-DOC115: faq.md no longer says no citation.* in 1.x", () => {
		const doc = read("docs/faq.md");
		expect(doc).not.toMatch(/no dedicated `citation\.\*` unified events in 1\.x/i);
		expect(doc).toContain("citationSpanAnchor");
	});

	it("LSA-DOC116: edge-cases.md cites CT/CO/GV/OC/CF citation IDs", () => {
		const doc = read("docs/edge-cases.md");
		expect(doc).toContain("LSA-CT01");
		expect(doc).toContain("LSA-CO99");
		expect(doc).toContain("LSA-CF01");
		expect(doc).toContain("LSA-OC276");
	});

	it("LSA-DOC117: README StreamEvent section includes citation and grounding", () => {
		const readme = read("README.md");
		expect(readme).toMatch(/citations.*grounding|grounding.*citations/i);
		expect(readme).toContain("stream-event.svg");
	});

	it("LSA-DOC118: proposal.md out-of-scope table updated (citations shipped)", () => {
		const doc = read("docs/proposal.md");
		expect(doc).not.toMatch(/Logprobs \/ citations \(future\)/);
		expect(doc).toMatch(/1\.6\.0.*citation|grounding shipped/i);
	});

	it("LSA-DOC119: roadmap open question 3 marked resolved", () => {
		const doc = read("docs/post-1.0-provider-roadmap.md");
		expect(doc).toMatch(
			/3\. \*\*Citation \/ grounding events\*\* — ✅ resolved in \*\*1\.6\.0\*\*/,
		);
	});

	it("LSA-DOC120: stream-event.mmd includes Citation and Grounding nodes", () => {
		const mmd = read("docs/img/stream-event.mmd");
		expect(mmd).toContain("citation");
		expect(mmd).toContain("grounding");
		expect(mmd).toContain("Provenance");
	});

	it("LSA-DOC121: integration cookbook mentions citation mapping and proxy SSE", () => {
		const doc = read("docs/integration-cookbook.md");
		expect(doc).toMatch(/Citation and grounding in proxy SSE/i);
		expect(doc).toContain("citationSpanAnchor");
		expect(doc).toContain("toSSE");
	});

	it("LSA-DOC122: CHANGELOG 1.6.0 section documents historical test badge 1799", () => {
		const changelog = read("CHANGELOG.md");
		const section = changelog.split("## [1.6.0]")[1]?.split("## [")[0] ?? "";
		expect(section).toMatch(/1799/);
	});

	it("LSA-DOC123: adapter-guide documents emitLegacyCitationMetadata deprecation", () => {
		const doc = read("docs/adapter-guide.md");
		expect(doc).toContain("emitLegacyCitationMetadata");
		expect(doc).toMatch(/deprecated|migration/i);
	});

	it("LSA-DOC124: edge-cases.md cites CF01–CF05 conformance suite", () => {
		const doc = read("docs/edge-cases.md");
		expect(doc).toContain("LSA-CF01");
		expect(doc).toContain("LSA-CF05");
	});

	it("LSA-DOC125: integration-cookbook cites proxy SSE toSSE citation round-trip", () => {
		const doc = read("docs/integration-cookbook.md");
		expect(doc).toMatch(/LSA-CT24|round-trip/i);
		expect(doc).toContain("DOC125");
	});

	it("LSA-DOC126: README or adapter-guide references citationSpanAnchor helper", () => {
		const readme = read("README.md");
		const guide = read("docs/adapter-guide.md");
		expect(readme.includes("citationSpanAnchor") || guide.includes("citationSpanAnchor")).toBe(
			true,
		);
	});
});
