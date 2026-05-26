import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "../..");

function read(path: string): string {
	return readFileSync(join(rootDir, path), "utf8");
}

describe("examples docs regression", () => {
	it("LSA-X21: examples README documents all examples", () => {
		const docs = read("examples/README.md");
		for (const name of [
			"openai-chat",
			"openai-compatible",
			"anthropic",
			"gemini",
			"perplexity",
			"xai",
			"azure-openai",
			"workers-ai",
			"replay-fixture",
			"proxy-safety",
		]) {
			expect(docs).toContain(name);
		}
	});

	it("LSA-X22: root README links examples", () => {
		expect(read("README.md")).toContain("examples/node-fetch/openai-chat.ts");
	});

	it("LSA-X23: README documents proxy safety and sanitizeErrors", () => {
		const docs = read("README.md");
		expect(docs).toContain("Proxy safety");
		expect(docs).toContain("sanitizeErrors");
	});

	it("LSA-X24: proxy safety README warns not to expose raw provider errors", () => {
		expect(read("examples/proxy-safety/README.md")).toContain("Never forward raw");
	});

	it("LSA-X25: example files mention env vars but contain no real secrets", () => {
		const files = [
			"examples/node-fetch/openai-chat.ts",
			"examples/node-fetch/openai-compatible.ts",
			"examples/node-fetch/anthropic.ts",
			"examples/node-fetch/gemini.ts",
			"examples/node-fetch/azure-openai.ts",
		];
		for (const file of files) {
			const text = read(file);
			expect(text).toMatch(/API_KEY|BASE_URL|MODEL/u);
			expect(text).not.toMatch(/sk-[A-Za-z0-9]{10,}/u);
		}
	});

	it("LSA-X26: no example imports provider SDK packages", () => {
		const all = [
			"examples/node-fetch/openai-chat.ts",
			"examples/node-fetch/openai-compatible.ts",
			"examples/node-fetch/anthropic.ts",
			"examples/node-fetch/gemini.ts",
			"examples/proxy-safety/web-standard-proxy.ts",
		]
			.map(read)
			.join("\n");
		expect(all).not.toContain('from "openai"');
		expect(all).not.toContain('from "@anthropic-ai');
	});

	it("LSA-X27: no example adds runtime dependencies", () => {
		const pkg = JSON.parse(read("package.json")) as { dependencies?: Record<string, string> };
		expect(Object.keys(pkg.dependencies ?? {})).toEqual([]);
	});

	it("LSA-X28: changelog documents examples and proxy safety", () => {
		const changelog = read("CHANGELOG.md");
		expect(changelog).toContain("[0.6.0]");
		expect(changelog).toContain("proxy safety");
	});

	it("LSA-X29: example files do not read process.env outside exported functions", () => {
		const text = read("examples/node-fetch/openai-chat.ts");
		expect(text.indexOf("process.env")).toBeGreaterThan(text.indexOf("runOpenAIChatExample"));
	});

	it("LSA-X30: example files do not call fetch at module import time", () => {
		const text = read("examples/node-fetch/openai-chat.ts");
		expect(text.indexOf("fetchImpl(")).toBeGreaterThan(text.indexOf("runOpenAIChatExample"));
	});

	it("LSA-X31: optional CLI guards do not execute during import", async () => {
		await expect(import("../../examples/node-fetch/openai-chat")).resolves.toBeDefined();
	});

	it("LSA-X37: root README and examples README list workers-ai example", () => {
		expect(read("README.md")).toContain("examples/workers-ai/rest-chat-completions.ts");
		expect(read("examples/README.md")).toContain("workers-ai");
		expect(read("examples/README.md")).toContain("rest-chat-completions.ts");
	});

	it("LSA-X38: env example documents Cloudflare Workers AI variables", () => {
		const env = read(".env.example");
		expect(env).toContain("CLOUDFLARE_API_TOKEN");
		expect(env).toContain("CLOUDFLARE_ACCOUNT_ID");
		expect(env).toContain("CLOUDFLARE_MODEL");
	});

	it("LSA-X42: README contains Why not just concatenate section", () => {
		expect(read("README.md")).toContain("Why not just concatenate");
	});

	it("LSA-X43: README links comparison, performance, and faq docs", () => {
		const readme = read("README.md");
		expect(readme).toContain("docs/comparison.md");
		expect(readme).toContain("docs/performance.md");
		expect(readme).toContain("docs/faq.md");
	});

	it("LSA-X44: comparison, performance, and faq docs exist with expected content", () => {
		const comparison = read("docs/comparison.md");
		expect(comparison).toContain("Vercel AI SDK");
		expect(comparison).toContain("When **not** to use this");

		const performance = read("docs/performance.md");
		expect(performance).toContain("LSA-C52");
		expect(performance).toContain("bench:smoke");

		const faq = read("docs/faq.md");
		expect(faq).toContain("EventAssembler");
		expect(faq).toContain("sanitizeErrors");
	});

	it("LSA-X45: README Architecture documents lifecycle and concurrency", () => {
		const readme = read("README.md");
		expect(readme).toContain("Lifecycle & concurrency");
		expect(readme).toMatch(/stateful per stream/i);
		expect(readme).toContain("reset()");
	});

	it("LSA-X46: README contains Quick decision guide and quick-decision.svg", () => {
		const readme = read("README.md");
		expect(readme).toContain("Quick decision guide");
		expect(readme).toContain("quick-decision.svg");
	});

	it("LSA-X47: README Architecture embeds assembler-lifecycle.svg", () => {
		expect(read("README.md")).toContain("assembler-lifecycle.svg");
	});

	it("LSA-X48: package.json keywords include ollama and structured-output", () => {
		const pkg = JSON.parse(read("package.json")) as { keywords?: string[] };
		expect(pkg.keywords).toContain("ollama");
		expect(pkg.keywords).toContain("structured-output");
		expect(pkg.keywords).toContain("stream-assembly");
	});

	it("LSA-X49: package.json scripts include bench:smoke", () => {
		const pkg = JSON.parse(read("package.json")) as { scripts?: Record<string, string> };
		expect(pkg.scripts?.["bench:smoke"]).toContain("bench-smoke");
	});

	it("LSA-X50: bench-smoke script exists and performance doc documents how to run it", () => {
		expect(read("scripts/bench-smoke.mjs")).toContain("LSA-C52");
		const performance = read("docs/performance.md");
		expect(performance).toContain("bench:smoke");
		expect(performance).toContain("bench-smoke.mjs");
	});
});
