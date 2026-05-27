import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { cohereAdapter } from "../src/adapters/cohere";
import { geminiAdapter } from "../src/adapters/gemini";
import { openaiCompatibleAdapter } from "../src/adapters/openai-compatible";
import {
	readExpectedEvents,
	runAdapterGoldenPayloads,
	runAdapterGoldenStream,
} from "./helpers/adapter-conformance";
import {
	assembleCohereResponse,
	cohereJsonlLines,
	expectedCohereEvents,
	normalizeCohereEvents,
} from "./helpers/cohere-fixtures";
import {
	expectedGeminiEvents,
	expectedVertexEvents,
	geminiTextFixture,
	normalizeGeminiEvents,
	vertexJsonlLines,
} from "./helpers/gemini-fixtures";
import { assembleStream } from "../src/core/assemble-stream";
import { byteStreamFromStrings, collectAsync } from "./helpers/collect-events";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const compatibleRoot = join(rootDir, "test/fixtures/openai-compatible");

describe("citation and grounding conformance", () => {
	it("LSA-CF01: Cohere citations-stream golden via runAdapterGoldenPayloads", async () => {
		const events = normalizeCohereEvents(
			await runAdapterGoldenPayloads({
				adapter: cohereAdapter(),
				lines: cohereJsonlLines("citations-stream"),
				expectedEventsPath: "",
			}),
		);
		expect(events).toEqual(expectedCohereEvents("citations-stream"));
		expect(events.some((event) => (event as { type?: string }).type === "citation")).toBe(true);
	});

	it("LSA-CF02: Perplexity citations-stream golden via runAdapterGoldenStream", async () => {
		const events = await runAdapterGoldenStream({
			adapter: openaiCompatibleAdapter({ provider: "perplexity" }),
			fixtureSsePath: join(compatibleRoot, "perplexity/citations-stream.sse"),
			expectedEventsPath: join(compatibleRoot, "perplexity/citations-stream.expected.json"),
		});
		const expected = readExpectedEvents(
			join(compatibleRoot, "perplexity/citations-stream.expected.json"),
		);
		expect(
			events.map((event) => {
				if (
					typeof event === "object" &&
					event !== null &&
					"type" in event &&
					(event.type === "citation" ||
						event.type === "grounding" ||
						event.type === "metadata" ||
						event.type === "usage")
				) {
					const { raw, ...rest } = event as { raw?: unknown };
					void raw;
					return rest;
				}
				return event;
			}),
		).toEqual(expected);
	});

	it("LSA-CF03: Vertex grounding-metadata golden via payloads helper", async () => {
		const events = normalizeGeminiEvents(
			await runAdapterGoldenPayloads({
				adapter: geminiAdapter({ apiSurface: "vertex" }),
				lines: vertexJsonlLines("grounding-metadata"),
				expectedEventsPath: "",
			}),
		);
		expect(events).toEqual(expectedVertexEvents("grounding-metadata"));
	});

	it("LSA-CF04: Google AI grounding-metadata.sse golden", async () => {
		const events = normalizeGeminiEvents(
			await collectAsync(
				assembleStream(
					byteStreamFromStrings(geminiTextFixture("grounding-metadata", "sse")),
					geminiAdapter(),
				),
			),
		);
		expect(events).toEqual(expectedGeminiEvents("grounding-metadata"));
	});

	it("LSA-CF05: Cohere response-citations assembleResponse matches golden", () => {
		expect(assembleCohereResponse("response-citations")).toEqual(
			expectedCohereEvents("response-citations"),
		);
	});
});
