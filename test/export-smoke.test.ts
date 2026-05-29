import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = join(rootDir, "dist");

const EXPORT_PATHS = [
	{ subpath: "llm-stream-assemble", importPath: join(distDir, "index.js") },
	{ subpath: "llm-stream-assemble/core", importPath: join(distDir, "core/index.js") },
	{
		subpath: "llm-stream-assemble/adapters/openai-chat",
		importPath: join(distDir, "adapters/openai-chat.js"),
	},
	{
		subpath: "llm-stream-assemble/adapters/openai-compatible",
		importPath: join(distDir, "adapters/openai-compatible.js"),
	},
	{
		subpath: "llm-stream-assemble/adapters/anthropic",
		importPath: join(distDir, "adapters/anthropic.js"),
	},
	{
		subpath: "llm-stream-assemble/adapters/openai-responses",
		importPath: join(distDir, "adapters/openai-responses.js"),
	},
	{
		subpath: "llm-stream-assemble/adapters/gemini",
		importPath: join(distDir, "adapters/gemini.js"),
	},
	{
		subpath: "llm-stream-assemble/adapters/bedrock",
		importPath: join(distDir, "adapters/bedrock.js"),
	},
	{
		subpath: "llm-stream-assemble/adapters/cohere",
		importPath: join(distDir, "adapters/cohere.js"),
	},
] as const;

const FACTORY_EXPORTS: Record<string, string> = {
	"llm-stream-assemble": "assembleStream",
	"llm-stream-assemble/core": "assembleStream",
	"llm-stream-assemble/adapters/openai-chat": "openaiChatAdapter",
	"llm-stream-assemble/adapters/openai-compatible": "openaiCompatibleAdapter",
	"llm-stream-assemble/adapters/anthropic": "anthropicAdapter",
	"llm-stream-assemble/adapters/openai-responses": "openaiResponsesAdapter",
	"llm-stream-assemble/adapters/gemini": "geminiAdapter",
	"llm-stream-assemble/adapters/bedrock": "bedrockAdapter",
	"llm-stream-assemble/adapters/cohere": "cohereAdapter",
};

describe("export smoke", () => {
	it("LSA-EXP01: all package.json export subpaths resolve after build", async () => {
		expect(existsSync(distDir)).toBe(true);

		for (const entry of EXPORT_PATHS) {
			expect(existsSync(entry.importPath)).toBe(true);
			const mod = await import(pathToFileURL(entry.importPath).href);
			const factoryName = FACTORY_EXPORTS[entry.subpath];
			expect(typeof mod[factoryName]).toBe("function");
		}
	});

	it("LSA-EXP02: package.json exports keys match smoke table", () => {
		const pkg = JSON.parse(readFileSync(join(rootDir, "package.json"), "utf8")) as {
			exports?: Record<string, unknown>;
		};
		const keys = Object.keys(pkg.exports ?? {}).sort();
		expect(keys).toEqual([
			".",
			"./adapters/anthropic",
			"./adapters/bedrock",
			"./adapters/cohere",
			"./adapters/gemini",
			"./adapters/openai-chat",
			"./adapters/openai-compatible",
			"./adapters/openai-responses",
			"./core",
		]);
	});
});
