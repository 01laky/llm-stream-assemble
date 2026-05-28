import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
	EVIL_OFFSET_SAMPLE_IDS,
	createAdapterForEntry,
	discoverResponseFixtures,
	discoverStreamFixtures,
	tier1FixtureCount,
} from "./helpers/fixture-catalog";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

const HARDENING_HELPERS = [
	"test/helpers/byte-stream.ts",
	"test/helpers/fixture-catalog.ts",
	"test/helpers/golden-parity.ts",
	"test/helpers/stream-invariants.ts",
	"test/helpers/simulated-provider.ts",
] as const;

const HARDENING_TESTS = [
	"test/chunk-split-matrix.test.ts",
	"test/adapter-conformance-matrix.test.ts",
	"test/parse-response-chunk-matrix.test.ts",
	"test/simulated-provider-e2e.test.ts",
	"test/replay-fixture-matrix.test.ts",
	"test/malformed-stream-matrix.test.ts",
	"test/transforms-golden.test.ts",
	"test/stream-concurrency.test.ts",
	"test/cross-adapter-contract-matrix.test.ts",
	"test/anthropic-fixture-parity.test.ts",
	"test/maintenance-hardening.test.ts",
] as const;

describe("maintenance hardening gates", () => {
	it("LSA-MAINT33: tier-1 fixture count meets 1.9.0 gate", () => {
		expect(tier1FixtureCount()).toBeGreaterThanOrEqual(165);
	});

	it("LSA-MAINT34: response fixture catalog count meets gate", () => {
		expect(discoverResponseFixtures().length).toBeGreaterThanOrEqual(30);
	});

	it("LSA-MAINT35: evil-offset sample fixtures exist in catalog", () => {
		const ids = discoverStreamFixtures().map((entry) => entry.id);
		for (const id of EVIL_OFFSET_SAMPLE_IDS) {
			expect(ids).toContain(id);
		}
	});

	it("LSA-MAINT36: chunk matrix exclusion documented in REGISTRY.md", () => {
		const registry = readFileSync(join(rootDir, "test/fixtures/REGISTRY.md"), "utf8");
		expect(registry).toContain("cohere/response-format-json.jsonl");
		expect(registry).toContain("discoverStreamFixtures");
	});

	it("LSA-MAINT37: createAdapterForEntry covers all catalog adapter keys", () => {
		const keys = new Set([
			...discoverStreamFixtures().map((entry) => entry.adapterKey),
			...discoverResponseFixtures().map((entry) => entry.adapterKey),
		]);
		for (const key of keys) {
			if (key === "unknown") continue;
			const sample =
				discoverStreamFixtures().find((entry) => entry.adapterKey === key) ??
				discoverResponseFixtures().find((entry) => entry.adapterKey === key);
			expect(() => createAdapterForEntry(sample!)).not.toThrow();
		}
	});

	it("LSA-MAINT38: hardening helper modules exist", () => {
		for (const file of HARDENING_HELPERS) {
			expect(existsSync(join(rootDir, file))).toBe(true);
		}
	});

	it("LSA-MAINT39: hardening test matrix files exist", () => {
		for (const file of HARDENING_TESTS) {
			expect(existsSync(join(rootDir, file))).toBe(true);
		}
	});

	it("LSA-MAINT40: fixtures audit registry script exists", () => {
		expect(existsSync(join(rootDir, "scripts/audit-fixture-registry.ts"))).toBe(true);
		const pkg = JSON.parse(readFileSync(join(rootDir, "package.json"), "utf8")) as {
			scripts?: Record<string, string>;
		};
		expect(pkg.scripts?.["fixtures:audit-registry"]).toBeDefined();
		expect(pkg.scripts?.verify).toContain("fixtures:audit-registry");
	});
});
