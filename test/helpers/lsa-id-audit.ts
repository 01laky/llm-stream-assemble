import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const LSA_ID_PATTERN = /\bit\(\s*["']LSA-([^"']+)["']/g;

export interface DuplicateLsaId {
	id: string;
	locations: string[];
}

function walkTestFiles(dir: string, files: string[] = []): string[] {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const fullPath = join(dir, entry.name);
		if (entry.isDirectory()) {
			walkTestFiles(fullPath, files);
		} else if (entry.name.endsWith(".test.ts")) {
			files.push(fullPath);
		}
	}
	return files;
}

export function findDuplicateLsaIds(testRoot: string): DuplicateLsaId[] {
	const idToLocations = new Map<string, string[]>();

	for (const filePath of walkTestFiles(testRoot)) {
		const source = readFileSync(filePath, "utf8");
		for (const match of source.matchAll(LSA_ID_PATTERN)) {
			const fullId = `LSA-${match[1]}`;
			const locations = idToLocations.get(fullId) ?? [];
			locations.push(filePath);
			idToLocations.set(fullId, locations);
		}
	}

	return [...idToLocations.entries()]
		.filter(([, locations]) => locations.length > 1)
		.map(([id, locations]) => ({ id, locations }))
		.sort((left, right) => left.id.localeCompare(right.id));
}
