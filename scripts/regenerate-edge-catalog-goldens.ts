/**
 * Regenerate edge-catalog .expected.json using the same normalizers as test parity.
 * Run: npx tsx scripts/regenerate-edge-catalog-goldens.ts
 * Check: npx tsx scripts/regenerate-edge-catalog-goldens.ts --check
 */
import { readFileSync, writeFileSync } from "node:fs";
import { discoverEdgeCatalogFixtures } from "../test/helpers/fixture-catalog.ts";
import { runGoldenStreamParity } from "../test/helpers/golden-parity.ts";

const checkMode = process.argv.includes("--check");

async function main(): Promise<void> {
	const entries = discoverEdgeCatalogFixtures();
	for (const entry of entries) {
		const events = await runGoldenStreamParity({ entry, byteChunkSize: 0 });
		const next = `${JSON.stringify(events, null, "\t")}\n`;
		if (checkMode) {
			const current = readFileSync(entry.expectedPath, "utf8");
			if (current !== next) {
				throw new Error(`Golden drift: ${entry.id}`);
			}
			continue;
		}
		writeFileSync(entry.expectedPath, next, "utf8");
	}
	console.log(`${checkMode ? "Checked" : "Regenerated"} ${entries.length} edge-catalog goldens`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
