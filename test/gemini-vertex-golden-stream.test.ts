import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
	assembleVertexJsonl,
	expectedVertexEvents,
	normalizeGeminiEvents,
} from "./helpers/gemini-fixtures";

const vertexFixturesDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures/gemini/vertex");

const streamFixtures = [
	"text-basic",
	"text-unicode",
	"text-empty-parts",
	"tool-single",
	"tool-parallel",
	"tool-partial-args",
	"tool-name-before-args",
	"tool-flush-without-terminal",
	"tool-args-object",
	"json-mode",
	"thinking",
	"usage-only",
	"metadata-early",
	"prompt-blocked",
	"provider-error",
	"finish-safety",
	"finish-max-tokens",
	"empty-candidates",
	"incomplete",
	"envelope-wrapped",
	"envelope-tuned-endpoint",
	"grounding-metadata",
	"grounding-chunks",
	"unknown-envelope",
] as const;

describe("geminiAdapter vertex golden jsonl fixtures", () => {
	it.each(streamFixtures.map((name, index) => [name, `LSA-GV${26 + index}`] as const))(
		"%s matches expected events (%s)",
		async (name) => {
			const jsonMode = name === "json-mode";
			const events = normalizeGeminiEvents(await assembleVertexJsonl(name, { jsonMode }));
			expect(events).toEqual(expectedVertexEvents(name));
		},
	);

	it("LSA-GV50: every vertex stream fixture has jsonl source and expected golden", () => {
		for (const name of streamFixtures) {
			expect(existsSync(join(vertexFixturesDir, `${name}.jsonl`))).toBe(true);
			expect(existsSync(join(vertexFixturesDir, `${name}.expected.json`))).toBe(true);
		}
	});
});
