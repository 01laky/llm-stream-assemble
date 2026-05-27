import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(path: string): string {
	return readFileSync(join(rootDir, path), "utf8");
}

describe("docs positioning 1.3.4 edge cases", () => {
	const readme = () => read("README.md");

	it("LSA-DOC01: README lists all eight Why-not-concatenate edge cases", () => {
		const text = readme();
		const edgeCases = [
			"SSE mid-line splits",
			"Tool argument fragmentation",
			"Anthropic id/index ordering",
			"Reasoning vs user text",
			"JSON mode streaming",
			"Stream lifecycle",
			"Mid-stream errors",
			"Dual code paths",
		];
		for (const edge of edgeCases) {
			expect(text).toContain(edge);
		}
	});

	it("LSA-DOC02: README Why section references assembleStream and assembleResponse", () => {
		const text = readme();
		expect(text).toContain("assembleStream");
		expect(text).toContain("assembleResponse");
	});

	it("LSA-DOC03: README Examples index covers OpenAI, Ollama, JSON mode, and tool calling", () => {
		const text = readme();
		expect(text).toContain("openaiChatAdapter");
		expect(text).toContain('provider: "ollama"');
		expect(text).toContain("jsonMode: true");
		expect(text).toContain("tool_call.args.delta");
		expect(text).toContain("tool_call.done");
	});

	it("LSA-DOC04: README Examples explicitly states no markdown/XML tag parser", () => {
		expect(readme()).toMatch(/does \*\*not\*\* parse markdown\/XML tags/i);
	});

	it("LSA-DOC05: comparison doc covers five alternative categories", () => {
		const doc = read("docs/comparison.md");
		expect(doc).toContain("Full-stack AI SDKs");
		expect(doc).toContain("Provider SDKs");
		expect(doc).toContain("Schema stream parsers");
		expect(doc).toContain("Tag / XML stream parsers");
		expect(doc).toContain("DIY concatenation");
	});

	it("LSA-DOC06: comparison doc lists four differentiators", () => {
		const doc = read("docs/comparison.md");
		for (const word of ["Simplicity", "Lower level", "Composable", "Framework agnostic"]) {
			expect(doc).toContain(word);
		}
	});

	it("LSA-DOC07: performance doc documents incremental SSE and maxBufferBytes", () => {
		const doc = read("docs/performance.md");
		expect(doc).toContain("parse-sse.ts");
		expect(doc).toContain("maxBufferBytes");
		expect(doc).toContain("strictToolArgs");
		expect(doc).not.toMatch(/optional `zod` peer/i);
	});

	it("LSA-DOC08: performance doc disclaims formal benchmark suite", () => {
		const doc = read("docs/performance.md");
		expect(doc).toMatch(/informal smoke benchmark/i);
		expect(doc).toMatch(/not a CI gate/i);
	});

	it("LSA-DOC09: FAQ answers all ten documented questions", () => {
		const faq = read("docs/faq.md");
		const headings = [
			"Why do I get `text.delta` but no `text.done`",
			"Can I reuse one adapter across concurrent requests",
			"Can I share one `EventAssembler` between streams",
			"Why is Anthropic tool input sometimes invalid JSON",
			"How do I proxy streams safely to a browser",
			"How is this different from the Vercel AI SDK",
			"Does JSON mode return parsed objects while streaming",
			"Why not just concatenate SSE chunks",
			"Does this library make HTTP calls",
			"How do I run the smoke benchmark locally",
			"How do I integrate with Hono, Express, Cloudflare Workers, or the Vercel AI SDK",
		];
		for (const heading of headings) {
			expect(faq).toContain(heading);
		}
	});

	it("LSA-DOC10: FAQ documents markdown/XML tag parsing as out of scope", () => {
		expect(read("docs/faq.md")).toMatch(/parse markdown or XML tags/i);
	});

	it("LSA-DOC11: adapter-guide documents assembler vs adapter state boundaries", () => {
		const guide = read("docs/adapter-guide.md");
		expect(guide).toContain("Assembler vs adapter state");
		expect(guide).toMatch(/stateful per stream/i);
		expect(guide).toContain("reset()");
		expect(guide).toContain("assembler-lifecycle.svg");
	});

	it("LSA-DOC12: diagram sources exist for quick-decision and assembler-lifecycle", () => {
		for (const name of ["quick-decision.mmd", "assembler-lifecycle.mmd"]) {
			expect(existsSync(join(rootDir, "docs/img", name))).toBe(true);
		}
	});

	it("LSA-DOC13: build-diagrams includes new mmd files", () => {
		const script = read("scripts/build-diagrams.mjs");
		expect(script).toContain("quick-decision.mmd");
		expect(script).toContain("assembler-lifecycle.mmd");
		expect(script).toContain("chunk-assembly.mmd");
	});

	it("LSA-DOC14: examples README has When to use which example table", () => {
		expect(read("examples/README.md")).toContain("When to use which example");
	});

	it("LSA-DOC15: examples README preserves Streaming JSON and tool calling section", () => {
		const doc = read("examples/README.md");
		expect(doc).toContain("Streaming JSON");
		expect(doc).toMatch(/tool calling/i);
	});

	it("LSA-DOC16: compatibility.md stable status is 1.6.0", () => {
		expect(read("docs/compatibility.md")).toMatch(/Stable `1\.[67]\.0`/);
	});

	it("LSA-DOC17: CHANGELOG 1.3.4 documents new docs and bench script", () => {
		const changelog = read("CHANGELOG.md");
		expect(changelog).toContain("## [1.3.4]");
		expect(changelog).toContain("docs/faq.md");
		expect(changelog).toContain("bench-smoke");
		expect(changelog).toContain("LSA-X42");
	});

	it("LSA-DOC18: README quick decision lists all five dedicated adapters", () => {
		const text = readme();
		expect(text).toContain("openaiChatAdapter()");
		expect(text).toContain("openaiResponsesAdapter()");
		expect(text).toContain("anthropicAdapter()");
		expect(text).toContain("geminiAdapter()");
		expect(text).toContain("openaiCompatibleAdapter({ provider })");
	});

	it("LSA-DOC19: README lifecycle section names all four public assembly entry points", () => {
		const text = readme();
		for (const entry of [
			"assembleStream",
			"assembleFromPayloads",
			"assembleResponse",
			"createAssemblyTransform",
		]) {
			expect(text).toContain(entry);
		}
	});

	it("LSA-DOC20: package.json description mentions composable positioning and unified events", () => {
		const pkg = JSON.parse(read("package.json")) as { description?: string };
		expect(pkg.description).toMatch(/Composable/i);
		expect(pkg.description).toMatch(/StreamEvent/i);
	});
});
