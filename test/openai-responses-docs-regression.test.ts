import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(path: string): string {
	return readFileSync(join(rootDir, path), "utf8");
}

describe("OpenAI Responses docs regression", () => {
	it("LSA-R37: fixture README exists and references all fixture families", () => {
		const readme = read("test/fixtures/openai-responses/README.md");
		for (const name of ["text-basic", "function-call", "failed", "response-text"]) {
			expect(readme).toContain(name);
		}
	});

	it("LSA-R38: README mentions OpenAI Responses adapter", () => {
		expect(read("README.md")).toContain("OpenAI Responses");
	});

	it("LSA-R39: compatibility matrix marks OpenAI Responses adapter support", () => {
		const docs = read("docs/compatibility.md");
		expect(docs).toContain("`openaiResponsesAdapter`");
		expect(docs).toContain("1.8.0");
	});

	it("LSA-R40: changelog documents OpenAI Responses adapter", () => {
		const changelog = read("CHANGELOG.md");
		expect(changelog).toContain("[0.7.0]");
		expect(changelog).toContain("OpenAI Responses adapter");
	});

	it("LSA-R41: fixture README documents provenance source values", () => {
		const readme = read("test/fixtures/openai-responses/README.md");
		expect(readme).toContain("synthetic");
		expect(readme).toContain("docs-shaped");
		expect(readme).toContain("redacted-live");
	});

	it("LSA-R97: adapter-guide documents Responses logprobs mapping", () => {
		const guide = read("docs/adapter-guide.md");
		expect(guide).toMatch(/Responses.*logprob|logprob.*Responses/i);
		expect(guide).toContain("message.output_text.logprobs");
	});

	it("LSA-R98: compatibility matrix documents Responses logprobs", () => {
		const docs = read("docs/compatibility.md");
		expect(docs).toMatch(/Responses.*logprob|logprob.*Responses/i);
	});

	it("LSA-R99: fixture README documents logprobs fixtures", () => {
		const readme = read("test/fixtures/openai-responses/README.md");
		expect(readme).toContain("logprobs-stream");
		expect(readme).toContain("LF06");
	});
});
