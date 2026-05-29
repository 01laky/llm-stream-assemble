import { existsSync, readFileSync, readdirSync } from "node:fs";
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
	"test/cross-adapter-contract-matrix-x196.test.ts",
	"test/anthropic-fixture-parity.test.ts",
	"test/maintenance-hardening.test.ts",
	"test/compatible-preset-scenario-matrix.test.ts",
	"test/stream-invariants-matrix.test.ts",
	"test/simulated-proxy-matrix.test.ts",
	"test/ai-sdk-mapper-exhaustive.test.ts",
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

	it("LSA-MAINT41: parse-response matrix includes expanded TH121-TH125 gate set", () => {
		const source = readFileSync(join(rootDir, "test/parse-response-chunk-matrix.test.ts"), "utf8");
		expect(source).toContain("[0, 1, 3, 7, 17, 31, 64]");
		expect(source).toContain("LSA-TH121");
		expect(source).toContain("LSA-TH125");
	});

	it("LSA-MAINT42: compatible preset scenario matrix exists with OC381 gate", () => {
		const source = readFileSync(
			join(rootDir, "test/compatible-preset-scenario-matrix.test.ts"),
			"utf8",
		);
		expect(source).toContain("LSA-OC381");
		expect(source).toContain("HOST_COMPATIBLE_PRESETS");
	});

	it("LSA-MAINT43: stream invariants matrix exists with AC100+ coverage", () => {
		const source = readFileSync(join(rootDir, "test/stream-invariants-matrix.test.ts"), "utf8");
		expect(source).toContain("LSA-AC100");
		expect(source).toContain("assertEventOrdering");
	});

	it("LSA-MAINT44b: cross adapter contract x196 expansion file exists", () => {
		const source = readFileSync(
			join(rootDir, "test/cross-adapter-contract-matrix-x196.test.ts"),
			"utf8",
		);
		expect(source).toContain("LSA-X196");
		expect(source).toContain("LSA-X280");
	});

	it("LSA-MAINT45b: malformed fixture catalog expanded beyond 25 files", () => {
		const malformedDir = join(rootDir, "test/fixtures/malformed");
		const files = readdirSync(malformedDir).filter(
			(name) => name.endsWith(".sse") || name.endsWith(".jsonl"),
		);
		expect(existsSync(join(malformedDir, "cohere-truncated-line.jsonl"))).toBe(true);
		expect(existsSync(join(malformedDir, "done-with-tail.sse"))).toBe(true);
		expect(files.length).toBeGreaterThanOrEqual(25);
	});

	it("LSA-MAINT46: simulated proxy matrix exists with INT85 gate", () => {
		const source = readFileSync(join(rootDir, "test/simulated-proxy-matrix.test.ts"), "utf8");
		expect(source).toContain("LSA-INT85");
		expect(source).toContain("createExpressProxyHandler");
		expect(source).toContain("handleHonoLLMProxy");
	});

	it("LSA-MAINT47b: compatible matrix includes waiver documentation text", () => {
		const source = readFileSync(
			join(rootDir, "test/compatible-preset-scenario-matrix.test.ts"),
			"utf8",
		);
		expect(source).toContain("MAINT47 waiver");
	});

	it("LSA-MAINT49: ai-sdk mapper exhaustive file includes RP31 and INT121+", () => {
		const source = readFileSync(join(rootDir, "test/ai-sdk-mapper-exhaustive.test.ts"), "utf8");
		expect(source).toContain("LSA-RP31");
		expect(source).toContain("LSA-INT${121 + index}");
	});

	it("LSA-TH141: release prep gate for minimum test count upgraded to 6000", () => {
		const source = readFileSync(join(rootDir, "scripts/release-prep.mjs"), "utf8");
		expect(source).toContain("MIN_TEST_COUNT = 6000");
		expect(source).toContain("LSA-REL33");
	});
});
