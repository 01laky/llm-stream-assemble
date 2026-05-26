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
});
