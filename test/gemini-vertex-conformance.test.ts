import { describe, expect, it } from "vitest";
import { geminiAdapter } from "../src/adapters/gemini";
import { runAdapterGoldenPayloads } from "./helpers/adapter-conformance";
import {
	expectedVertexEvents,
	normalizeGeminiEvents,
	vertexJsonlLines,
} from "./helpers/gemini-fixtures";

const conformanceFixtures = [
	"text-basic",
	"tool-single",
	"tool-parallel",
	"thinking",
	"json-mode",
	"provider-error",
	"finish-safety",
	"usage-only",
	"grounding-metadata",
	"envelope-wrapped",
] as const;

describe("geminiAdapter vertex conformance harness", () => {
	it("LSA-GV96: conformance harness covers representative vertex jsonl fixtures", async () => {
		for (const name of conformanceFixtures) {
			const jsonMode = name === "json-mode";
			const events = normalizeGeminiEvents(
				await runAdapterGoldenPayloads({
					adapter: geminiAdapter({ apiSurface: "vertex", jsonMode }),
					lines: vertexJsonlLines(name),
					expectedEventsPath: "",
				}),
			);
			expect(events).toEqual(expectedVertexEvents(name));
		}
	});
});
