import { readFileSync } from "node:fs";
import { join } from "node:path";

export function readRepoFile(rootDir: string, path: string): string {
	return readFileSync(join(rootDir, path), "utf8");
}

export function docCorpus(rootDir: string): string {
	return (
		readRepoFile(rootDir, "README.md") +
		readRepoFile(rootDir, "docs/usage-guides.md") +
		readRepoFile(rootDir, "examples/README.md")
	);
}

export function fullChangelogText(rootDir: string): string {
	return readRepoFile(rootDir, "CHANGELOG.md") + readRepoFile(rootDir, "CHANGELOG-archive.md");
}

export function fullChangelog(rootDir: string): string {
	return fullChangelogText(rootDir);
}

export function changelogSection(rootDir: string, version: string, nextVersion: string): string {
	return (
		fullChangelogText(rootDir).split(`## [${version}]`)[1]?.split(`## [${nextVersion}]`)[0] ?? ""
	);
}
