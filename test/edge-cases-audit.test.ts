import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const scriptPath = join(rootDir, "scripts/audit-edge-cases-catalog.ts");
const readmePath = join(rootDir, "test/fixtures/edge-catalog/README.md");

describe("edge-catalog maintenance audit", () => {
	it("LSA-MAINT48: audit-edge-cases-catalog --check passes", () => {
		const result = spawnSync("npx", ["tsx", scriptPath, "--check"], {
			cwd: rootDir,
			encoding: "utf8",
		});
		expect(result.status, result.stderr || result.stdout).toBe(0);
		expect(result.stdout).toContain("edge-catalog OK");
	});

	it("LSA-MAINT48b: edge-catalog README maps EC scenarios", () => {
		expect(existsSync(readmePath)).toBe(true);
		const readme = readFileSync(readmePath, "utf8");
		expect(readme).toContain("| EC01 |");
		expect(readme).toContain("| EC72 |");
		expect(readme).toContain("tier2-large-1.sse");
	});
});
