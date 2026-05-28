/**
 * Verifies test/fixtures/REGISTRY.md matches discoverStreamFixtures / discoverResponseFixtures.
 * Run: npx tsx scripts/audit-fixture-registry.ts
 * Check (CI): npx tsx scripts/audit-fixture-registry.ts --check
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
	discoverResponseFixtures,
	discoverStreamFixtures,
	EVIL_OFFSET_SAMPLE_IDS,
	tier1FixtureCount,
} from "../test/helpers/fixture-catalog.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const registryPath = join(root, "test/fixtures/REGISTRY.md");
const checkMode = process.argv.includes("--check");

const stream = discoverStreamFixtures();
const response = discoverResponseFixtures();
const tier1 = stream.filter((entry) => entry.tier === 1);

function extractBullets(sectionHeading: string, markdown: string): string[] {
	const sectionStart = markdown.indexOf(sectionHeading);
	if (sectionStart === -1) return [];
	const nextHeading = markdown.indexOf("\n## ", sectionStart + sectionHeading.length);
	const section =
		nextHeading === -1 ? markdown.slice(sectionStart) : markdown.slice(sectionStart, nextHeading);
	return [...section.matchAll(/^- `?([^`\n]+)`?$/gm)].map((match) => match[1].trim());
}

function extractSummaryCount(label: string, markdown: string): number | undefined {
	const match = markdown.match(new RegExp(`\\| ${label} \\| (\\d+) \\|`));
	return match ? Number(match[1]) : undefined;
}

function buildRegistryMarkdown(): string {
	const byAdapter = new Map<string, number>();
	for (const entry of stream) {
		byAdapter.set(entry.adapterKey, (byAdapter.get(entry.adapterKey) ?? 0) + 1);
	}

	let md = "# Fixture registry\n\n";
	md +=
		"Machine-readable catalog lives in `test/helpers/fixture-catalog.ts` (`discoverStreamFixtures`, `discoverResponseFixtures`).\n\n";
	md += "## Summary\n\n";
	md += "| Metric | Count |\n| --- | ---: |\n";
	md += `| Stream fixtures | ${stream.length} |\n`;
	md += `| Tier-1 stream fixtures | ${tier1FixtureCount()} |\n`;
	md += `| Response fixtures | ${response.length} |\n`;
	md += `| Evil-offset samples | ${EVIL_OFFSET_SAMPLE_IDS.length} |\n\n`;
	md += "## Exclusions\n\n";
	md +=
		"- `cohere/response-format-json.jsonl` — excluded from chunk/conformance matrices (stale jsonMode golden).\n";
	md +=
		"- `transforms/*` except `transforms/malformed.sse` — transform pipeline fixtures, not adapter goldens.\n";
	md += "- `bedrock/event-stream-bytes.jsonl` — tier-3 binary envelope sample.\n\n";
	md += "## Adapter stream counts\n\n| Adapter key | Fixtures |\n| --- | ---: |\n";
	for (const [key, count] of [...byAdapter.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
		md += `| ${key} | ${count} |\n`;
	}
	md += "\n## Tier-1 stream fixture IDs\n\n";
	for (const entry of tier1) md += `- ${entry.id}\n`;
	md += "\n## Response fixture IDs\n\n";
	for (const entry of response) md += `- ${entry.id}\n`;
	md += "\n## Evil-offset sample IDs\n\n";
	for (const id of EVIL_OFFSET_SAMPLE_IDS) md += `- ${id}\n`;
	return `${md}\n`;
}

const expected = buildRegistryMarkdown();

if (checkMode) {
	const current = readFileSync(registryPath, "utf8");
	if (current !== expected) {
		console.error(
			"fixture registry drift: run npx tsx scripts/audit-fixture-registry.ts to refresh REGISTRY.md",
		);
		process.exit(1);
	}

	const listedTier1 = extractBullets("## Tier-1 stream fixture IDs", current);
	const listedResponse = extractBullets("## Response fixture IDs", current);
	const listedEvil = extractBullets("## Evil-offset sample IDs", current);

	if (listedTier1.length !== tier1.length) {
		console.error(
			`tier-1 ID count mismatch: registry ${listedTier1.length} catalog ${tier1.length}`,
		);
		process.exit(1);
	}
	for (const entry of tier1) {
		if (!listedTier1.includes(entry.id)) {
			console.error(`missing tier-1 id in registry: ${entry.id}`);
			process.exit(1);
		}
	}
	for (const entry of response) {
		if (!listedResponse.includes(entry.id)) {
			console.error(`missing response id in registry: ${entry.id}`);
			process.exit(1);
		}
	}
	for (const id of EVIL_OFFSET_SAMPLE_IDS) {
		if (!listedEvil.includes(id)) {
			console.error(`missing evil-offset id in registry: ${id}`);
			process.exit(1);
		}
	}

	const summaryChecks: Array<[string, number]> = [
		["Stream fixtures", stream.length],
		["Tier-1 stream fixtures", tier1FixtureCount()],
		["Response fixtures", response.length],
		["Evil-offset samples", EVIL_OFFSET_SAMPLE_IDS.length],
	];
	for (const [label, count] of summaryChecks) {
		if (extractSummaryCount(label, current) !== count) {
			console.error(`summary count mismatch for ${label}`);
			process.exit(1);
		}
	}

	console.log(
		`fixture registry OK (${stream.length} stream, ${tier1.length} tier-1, ${response.length} response)`,
	);
} else {
	writeFileSync(registryPath, expected);
	console.log(`wrote ${registryPath}`);
}
