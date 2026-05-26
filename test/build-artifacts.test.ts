import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

const subpathEntries = [
	{ id: "LSA-P01", path: "dist/index.js", exportName: "assembleStream" },
	{ id: "LSA-P02", path: "dist/core/index.js", exportName: "assembleStream" },
	{ id: "LSA-P03", path: "dist/adapters/openai-chat.js", exportName: "openaiChatAdapter" },
	{
		id: "LSA-P04",
		path: "dist/adapters/openai-compatible.js",
		exportName: "openaiCompatibleAdapter",
	},
	{ id: "LSA-P05", path: "dist/adapters/anthropic.js", exportName: "anthropicAdapter" },
	{
		id: "LSA-P06",
		path: "dist/adapters/openai-responses.js",
		exportName: "openaiResponsesAdapter",
	},
	{ id: "LSA-P07", path: "dist/adapters/gemini.js", exportName: "geminiAdapter" },
] as const;

const declarationArtifacts = [
	"dist/index.d.ts",
	"dist/index.d.cts",
	"dist/core/index.d.ts",
	"dist/adapters/openai-chat.d.ts",
	"dist/adapters/openai-compatible.d.ts",
	"dist/adapters/anthropic.d.ts",
	"dist/adapters/openai-responses.d.ts",
	"dist/adapters/openai-responses.d.cts",
	"dist/adapters/openai-responses.js",
	"dist/adapters/openai-responses.cjs",
	"dist/adapters/gemini.d.ts",
	"dist/adapters/gemini.d.cts",
	"dist/adapters/gemini.js",
	"dist/adapters/gemini.cjs",
	"dist/index.js",
	"dist/index.cjs",
	"dist/core/index.js",
	"dist/core/index.cjs",
] as const;

beforeAll(() => {
	if (!existsSync(join(rootDir, "dist/index.d.ts"))) {
		execSync("pnpm build", { cwd: rootDir, stdio: "pipe" });
	}
});

describe("subpath-exports.test.ts", () => {
	describe.each(subpathEntries)("$id", ({ path, exportName }) => {
		it(`loads ${exportName} from ${path}`, async () => {
			const modulePath = join(rootDir, path);
			expect(existsSync(modulePath)).toBe(true);
			const mod = (await import(modulePath)) as Record<string, unknown>;
			expect(typeof mod[exportName]).toBe("function");
		});
	});
});

describe("build-artifacts.test.ts", () => {
	describe.each(
		declarationArtifacts.map((file, index) => ({
			id: `LSA-B${String(index + 1).padStart(2, "0")}`,
			file,
		})),
	)("$id", ({ file }) => {
		it(`exists: ${file}`, () => {
			expect(existsSync(join(rootDir, file))).toBe(true);
		});
	});
});
