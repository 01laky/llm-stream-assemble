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
] as const;

const declarationArtifacts = [
	"dist/index.d.ts",
	"dist/index.d.cts",
	"dist/core/index.d.ts",
	"dist/adapters/openai-chat.d.ts",
	"dist/adapters/openai-compatible.d.ts",
	"dist/adapters/anthropic.d.ts",
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
