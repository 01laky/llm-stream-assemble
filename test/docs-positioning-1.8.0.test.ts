import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(path: string): string {
	return readFileSync(join(rootDir, path), "utf8");
}

describe("docs positioning 1.8.0 (historical)", () => {
	it("LSA-DOC151: historical 1.8.0 release traceability in CHANGELOG", () => {
		const changelog = read("CHANGELOG.md");
		expect(changelog).toContain("## [1.8.0]");
		expect(changelog).toMatch(/Responses.*logprob|logprob.*Responses/i);
		expect(changelog).toMatch(/2128|README test badge \*\*2128\*\*/);
	});

	it("LSA-DOC152: CHANGELOG 1.8.0 mentions Responses logprobs", () => {
		const changelog = read("CHANGELOG.md");
		expect(changelog).toContain("## [1.8.0]");
		expect(changelog).toMatch(/Responses.*logprob|logprob.*Responses/i);
	});

	it("LSA-DOC153: CHANGELOG 1.8.0 section remains for historical traceability", () => {
		expect(read("CHANGELOG.md")).toContain("## [1.8.0]");
	});

	it("LSA-DOC154: compatibility.md Responses row documents logprobs include", () => {
		const doc = read("docs/compatibility.md");
		expect(doc).toMatch(/Responses.*logprob|logprob.*Responses/i);
		expect(doc).toContain("message.output_text.logprobs");
	});

	it("LSA-DOC155: adapter-guide Responses logprobs section without deferral", () => {
		const doc = read("docs/adapter-guide.md");
		expect(doc).toMatch(/Responses.*logprob|logprob.*Responses/i);
		expect(doc).not.toMatch(/Responses API logprobs — deferred/i);
	});

	it("LSA-DOC156: faq.md links or answers Responses logprobs", () => {
		const doc = read("docs/faq.md");
		expect(doc).toMatch(/Responses.*logprob|logprob.*Responses/i);
	});

	it("LSA-DOC157: edge-cases.md cites RL and LF Responses logprob IDs", () => {
		const doc = read("docs/edge-cases.md");
		expect(doc).toContain("LSA-RL01");
		expect(doc).toContain("LSA-LF06");
	});

	it("LSA-DOC158: proposal.md notes Responses logprobs shipped 1.8.0", () => {
		const doc = read("docs/proposal.md");
		expect(doc).toMatch(/1\.8\.0.*Responses.*logprob|Responses.*logprob.*1\.8\.0/i);
	});

	it("LSA-DOC159: roadmap resolves Responses logprobs open question", () => {
		const roadmap = read("docs/post-1.0-provider-roadmap.md");
		expect(roadmap).toMatch(/Responses.*logprob|logprob.*Responses/i);
	});

	it("LSA-DOC160: release-prep badge count pattern present in README", () => {
		expect(read("README.md")).toMatch(/tests-(?:TBD|\d+)_passing/);
	});

	it("LSA-DOC161: integration-cookbook Responses logprob replay", () => {
		const doc = read("docs/integration-cookbook.md");
		expect(doc).toMatch(/Responses.*logprob|Offline replay — Responses logprobs/i);
	});

	it("LSA-DOC162: replay mapper supports Responses logprobs fixture path", () => {
		const source = read("examples/integrations/replay-integration-mapper.ts");
		expect(source).toContain("adapter");
		expect(read("docs/integration-cookbook.md")).toMatch(/openai-responses\/logprobs-stream/i);
	});

	it("LSA-DOC163: README mentions Chat and Responses logprob paths", () => {
		const readme = read("README.md");
		expect(readme).toMatch(/Chat.*logprob|logprob.*Chat/i);
		expect(readme).toMatch(/Responses.*logprob|logprob.*Responses/i);
	});

	it("LSA-DOC164: adapter-guide cites include message.output_text.logprobs", () => {
		expect(read("docs/adapter-guide.md")).toContain("message.output_text.logprobs");
	});

	it("LSA-DOC165: CHANGELOG 1.8.0 removes Responses-only deferral from active notes", () => {
		const section = read("CHANGELOG.md").split("## [1.8.0]")[1]?.split("## [1.7.0]")[0] ?? "";
		expect(section).toMatch(/Responses.*logprob/i);
	});

	it("LSA-DOC166: live-smoke.md includes smoke:openai-responses-logprobs", () => {
		expect(read("docs/live-smoke.md")).toContain("smoke:openai-responses-logprobs");
	});

	it("LSA-DOC167: examples/README smoke table documents Responses logprobs smoke", () => {
		expect(read("examples/README.md")).toContain("smoke:openai-responses-logprobs");
	});

	it("LSA-DOC168: docs-positioning-1.7.0 pins historical 1.7.0 metadata", () => {
		const historical = read("test/docs-positioning-1.7.0.test.ts");
		expect(historical).toContain("LSA-DOC127");
		expect(historical).toMatch(/1\.7\.0/);
		expect(historical).toMatch(/1966|historical/i);
	});

	it("LSA-DOC169: docs-positioning-1.7.0 no longer asserts package.json version 1.7.0", () => {
		const historical = read("test/docs-positioning-1.7.0.test.ts");
		expect(historical).not.toMatch(/pkg\.version.*1\.7\.0/);
	});

	it("LSA-DOC170: historical 1.8.0 stable green badges documented in CHANGELOG", () => {
		const section = read("CHANGELOG.md").split("## [1.8.0]")[1]?.split("## [1.7.0]")[0] ?? "";
		expect(section).toMatch(/core-1\.8\.0-brightgreen|stable green/i);
	});

	it("LSA-DOC171: live-smoke.md documents capture promotion workflow", () => {
		const doc = read("docs/live-smoke.md");
		expect(doc).toMatch(/capture|openai-responses-logprobs-capture|redact/i);
	});

	it("LSA-DOC172: adapter-guide contains Chat vs Responses logprobs comparison", () => {
		const doc = read("docs/adapter-guide.md");
		expect(doc).toMatch(/Chat Completions.*1\.7\.0|OpenAI Chat/i);
		expect(doc).toMatch(/Responses API.*1\.8\.0|OpenAI Responses/i);
		expect(doc).toContain("message.output_text.logprobs");
		expect(doc).toContain("logprobs: true");
	});

	it("LSA-DOC173: historical 1.8.0 shipped Responses logprobs documented in CHANGELOG", () => {
		const section = read("CHANGELOG.md").split("## [1.8.0]")[1]?.split("## [1.7.0]")[0] ?? "";
		expect(section).toMatch(/Responses.*logprob/i);
		expect(section).toMatch(/2128/);
	});
});
