import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(path: string): string {
	return readFileSync(join(rootDir, path), "utf8");
}

describe("docs positioning 1.7.0", () => {
	it("LSA-DOC127: README badges reference 1.7.0 and test count badge", () => {
		const readme = read("README.md");
		expect(readme).toContain("core-1.7.0");
		expect(readme).toMatch(/Stable `1\.7\.0`/);
		expect(readme).toMatch(/tests-(?:TBD|\d+)_passing/);
	});

	it("LSA-DOC128: CHANGELOG 1.7.0 mentions logprob events", () => {
		const changelog = read("CHANGELOG.md");
		expect(changelog).toContain("## [1.7.0]");
		expect(changelog).toMatch(/logprob/i);
	});

	it("LSA-DOC129: package.json version is 1.7.0", () => {
		const pkg = JSON.parse(read("package.json")) as { version: string };
		expect(pkg.version).toBe("1.7.0");
	});

	it("LSA-DOC130: compatibility matrix documents OpenAI Chat logprobs mapping", () => {
		const doc = read("docs/compatibility.md");
		expect(doc).toMatch(/logprobs.*logprob|logprob.*events/i);
		expect(doc).toContain("LSA-LP01");
	});

	it("LSA-DOC131: adapter-guide documents logprob mapping and request prerequisites", () => {
		const doc = read("docs/adapter-guide.md");
		expect(doc).toMatch(/logprob.*StreamEvent|StreamEvent.*logprob/i);
		expect(doc).toContain("logprobs: true");
		expect(doc).toContain("shared/logprobs.ts");
	});

	it("LSA-DOC132: faq.md answers logprobs or links adapter-guide", () => {
		const doc = read("docs/faq.md");
		expect(doc).toMatch(/logprob|logprobs/i);
	});

	it("LSA-DOC133: edge-cases.md cites logprob test provenance", () => {
		const doc = read("docs/edge-cases.md");
		expect(doc).toMatch(/LSA-LP01|logprobs-core|1\.7\.0.*logprob/i);
	});

	it("LSA-DOC134: README StreamEvent section includes logprob", () => {
		const readme = read("README.md");
		expect(readme).toMatch(/logprob/i);
		expect(readme).toContain("stream-event.svg");
	});

	it("LSA-DOC135: proposal.md notes logprobs shipped in 1.7.0", () => {
		const doc = read("docs/proposal.md");
		expect(doc).toMatch(/1\.7\.0.*logprob|logprob.*1\.7\.0/i);
	});

	it("LSA-DOC136: roadmap resolves logprobs deferral for Chat Completions", () => {
		const roadmap = read("docs/post-1.0-provider-roadmap.md");
		const changelog17 = read("CHANGELOG.md").split("## [1.6.0]")[0] ?? "";
		expect(roadmap).toMatch(/1\.7\.0.*logprob|logprob.*1\.7\.0/i);
		expect(changelog17).not.toMatch(/Still deferred: logprobs events/);
	});

	it("LSA-DOC137: stream-event.mmd includes logprob under Provenance", () => {
		const mmd = read("docs/img/stream-event.mmd");
		expect(mmd).toContain("logprob");
		expect(mmd).toContain("Provenance");
	});

	it("LSA-DOC138: edge-cases.md cites LF01–LF05 conformance suite", () => {
		const doc = read("docs/edge-cases.md");
		expect(doc).toContain("LSA-LF01");
		expect(doc).toMatch(/LSA-LF01[\s\S]*LF08/);
	});

	it("LSA-DOC139: integration-cookbook cites proxy SSE logprob subsection", () => {
		const doc = read("docs/integration-cookbook.md");
		expect(doc).toMatch(/logprob|Logprobs through proxy SSE/i);
	});

	it("LSA-DOC140: release-prep badge pattern present in README", () => {
		const readme = read("README.md");
		expect(readme).toMatch(/tests-(?:TBD|\d+)_passing/);
	});

	it("LSA-DOC141: integration-cookbook token confidence cites LPH", () => {
		const doc = read("docs/integration-cookbook.md");
		expect(doc).toMatch(/logprobConfidence|LSA-LPH/i);
	});

	it("LSA-DOC142: stream-event-to-ai-sdk-parts maps logprob", () => {
		const source = read("examples/integrations/stream-event-to-ai-sdk-parts.ts");
		expect(source).toContain('case "logprob"');
		expect(source).toContain("token-logprob");
	});

	it("LSA-DOC143: README or adapter-guide references logprobConfidence", () => {
		const readme = read("README.md");
		const guide = read("docs/adapter-guide.md");
		expect(readme.includes("logprobConfidence") || guide.includes("logprobConfidence")).toBe(true);
	});

	it("LSA-DOC144: README or adapter-guide references alignLogprobsWithText", () => {
		const readme = read("README.md");
		const guide = read("docs/adapter-guide.md");
		expect(
			readme.includes("alignLogprobsWithText") || guide.includes("alignLogprobsWithText"),
		).toBe(true);
	});

	it("LSA-DOC145: integration-cookbook cites offline logprob replay INT52–INT54", () => {
		const doc = read("docs/integration-cookbook.md");
		expect(doc).toMatch(/INT52|Offline logprob replay|replay-integration-mapper/i);
	});

	it("LSA-DOC146: docs/live-smoke.md smoke index includes smoke:openai-logprobs", () => {
		const doc = read("docs/live-smoke.md");
		expect(doc).toContain("smoke:openai-logprobs");
	});

	it("LSA-DOC147: examples/README.md documents pnpm smoke:openai-logprobs", () => {
		const doc = read("examples/README.md");
		expect(doc).toContain("smoke:openai-logprobs");
	});

	it("LSA-DOC148: docs-positioning-1.6.0 DOC110 pins historical 1.6.0 and 1799 tests", () => {
		const historical = read("test/docs-positioning-1.6.0.test.ts");
		expect(historical).toContain("LSA-DOC110");
		expect(historical).toMatch(/1\.6\.0/);
		expect(historical).toMatch(/1799|historical/i);
	});

	it("LSA-DOC149: docs-positioning-1.6.0 no longer asserts package.json version 1.6.0", () => {
		const historical = read("test/docs-positioning-1.6.0.test.ts");
		expect(historical).not.toMatch(/pkg\.version.*1\.6\.0/);
		expect(historical).toMatch(/DOC112.*CHANGELOG.*1\.6\.0/i);
	});

	it("LSA-DOC150: active package.json version is 1.7.0", () => {
		const pkg = JSON.parse(read("package.json")) as { version: string };
		expect(pkg.version).toBe("1.7.0");
	});
});
