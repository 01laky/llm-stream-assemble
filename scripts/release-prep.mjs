#!/usr/bin/env node
/**
 * Pre-release checks for llm-stream-assemble.
 * Does not tag, publish, or mutate git — prints actionable next steps.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(path) {
	return readFileSync(join(rootDir, path), "utf8");
}

function ok(message) {
	console.log(`OK: ${message}`);
}

function warn(message) {
	console.warn(`WARN: ${message}`);
}

function npmLatestVersion() {
	try {
		return execFileSync("npm", ["view", "llm-stream-assemble", "version"], {
			cwd: rootDir,
			encoding: "utf8",
			stdio: ["ignore", "pipe", "ignore"],
		}).trim();
	} catch {
		return null;
	}
}

function gitStatusPorcelain() {
	try {
		return execFileSync("git", ["status", "--porcelain"], {
			cwd: rootDir,
			encoding: "utf8",
		}).trim();
	} catch {
		return null;
	}
}

function gitHead() {
	try {
		return execFileSync("git", ["rev-parse", "--short", "HEAD"], {
			cwd: rootDir,
			encoding: "utf8",
		}).trim();
	} catch {
		return "unknown";
	}
}

const pkg = JSON.parse(read("package.json"));
const version = pkg.version;
const tag = `v${version}`;
const readme = read("README.md");
const changelog = read("CHANGELOG.md");
const errors = [];

console.log(`Release prep for llm-stream-assemble@${version} (git ${gitHead()})\n`);

if (!readme.includes(`Stable \`${version}\``)) {
	errors.push(`README.md missing Stable \`${version}\``);
} else {
	ok(`README stable status references ${version}`);
}

const stableBadge = `status-stable_${version}-brightgreen`;
if (!readme.includes(stableBadge)) {
	errors.push(`README.md missing ${stableBadge} status badge`);
} else {
	ok(`README status badge is stable green (${stableBadge})`);
}

if (/status-beta_|status-pre_|_rc-orange|_beta-yellow/i.test(readme)) {
	errors.push("README.md still has beta or pre-release status badge");
}

const coreBadge = `core-${version}-brightgreen`;
if (!readme.includes(coreBadge)) {
	errors.push(`README.md missing ${coreBadge} core badge`);
} else {
	ok(`README core badge is stable green (${coreBadge})`);
}

if (readme.includes(`core-${version}-blue`)) {
	errors.push(`README.md core badge still uses beta blue (core-${version}-blue)`);
}

if (!changelog.includes(`## [${version}]`)) {
	errors.push(`CHANGELOG.md missing ## [${version}]`);
} else {
	ok(`CHANGELOG has ## [${version}]`);
}

const distFiles = [
	"dist/index.js",
	"dist/index.d.ts",
	"dist/adapters/gemini.js",
	"dist/adapters/bedrock.js",
	"dist/adapters/cohere.js",
	"dist/adapters/openai-compatible.js",
];
for (const file of distFiles) {
	if (!existsSync(join(rootDir, file))) {
		errors.push(`missing build artifact ${file} — run pnpm build`);
	}
}
if (errors.every((message) => !message.startsWith("missing build"))) {
	ok("dist build artifacts present");
}

if (Object.keys(pkg.dependencies ?? {}).length > 0) {
	errors.push("package.json must have zero runtime dependencies");
} else {
	ok("zero runtime dependencies");
}

const npmVersion = npmLatestVersion();
if (npmVersion === null) {
	warn("could not read npm registry version (offline or package unpublished)");
} else if (npmVersion === version) {
	warn(`npm already lists ${version} — skip publish unless republishing`);
} else {
	ok(`npm latest is ${npmVersion}; local is ${version}`);
}

function readmeTestsBadgeCount() {
	const match = readme.match(/tests-(\d+)_passing/);
	return match ? Number(match[1]) : null;
}

function vitestPassedCount() {
	try {
		const output = execFileSync("npm", ["test"], {
			cwd: rootDir,
			encoding: "utf8",
			stdio: ["ignore", "pipe", "pipe"],
		});
		const match = output.match(/Tests\s+(\d+)\s+passed/);
		return match ? Number(match[1]) : null;
	} catch (error) {
		const output = `${error.stdout ?? ""}${error.stderr ?? ""}`;
		const match = output.match(/Tests\s+(\d+)\s+passed/);
		return match ? Number(match[1]) : null;
	}
}

const badgeCount = readmeTestsBadgeCount();
const passedCount = vitestPassedCount();
const MIN_TEST_COUNT = 4000;
if (badgeCount === null) {
	errors.push("README.md missing tests-N_passing badge");
} else if (badgeCount < MIN_TEST_COUNT) {
	errors.push(`README tests badge (${badgeCount}) below minimum ${MIN_TEST_COUNT} (LSA-REL33)`);
} else {
	ok(`README tests badge meets minimum ${MIN_TEST_COUNT} (LSA-REL33)`);
	if (passedCount === null) {
		warn("could not parse vitest passed count from npm test output");
	} else if (badgeCount !== passedCount) {
		errors.push(
			`README tests badge (${badgeCount}) does not match vitest passed count (${passedCount})`,
		);
	} else {
		ok(`README tests badge matches vitest count (${passedCount})`);
	}
}

const dirty = gitStatusPorcelain();
if (dirty) {
	warn(
		"working tree has uncommitted changes:\n" +
			dirty
				.split("\n")
				.map((line) => `  ${line}`)
				.join("\n"),
	);
} else {
	ok("git working tree clean");
}

try {
	const output = execFileSync("npm", ["pack", "--dry-run", "--json"], {
		cwd: rootDir,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	});
	const [pack] = JSON.parse(output);
	const paths = pack.files.map((file) => file.path);
	for (const required of ["dist/index.js", "README.md", "LICENSE"]) {
		if (!paths.includes(required)) {
			errors.push(`npm pack missing ${required}`);
		}
	}
	if (errors.every((message) => !message.startsWith("npm pack missing"))) {
		ok(`npm pack dry-run includes ${paths.length} files`);
	}
} catch (error) {
	errors.push(`npm pack --dry-run failed: ${error.message}`);
}

if (errors.length > 0) {
	console.error("\nRelease prep failed:");
	for (const message of errors) console.error(`  - ${message}`);
	process.exitCode = 1;
} else {
	console.log("\nRelease prep passed.");
}

console.log(`
Next steps (manual):
  1. pnpm verify
  2. git tag ${tag} && git push origin ${tag}
  3. npm publish
  4. GitHub Release from CHANGELOG ## [${version}]
     Draft: .local-playground/release-${version}.md (if present)
  5. npm view llm-stream-assemble version
`);

if (process.exitCode === 1) process.exit(1);
