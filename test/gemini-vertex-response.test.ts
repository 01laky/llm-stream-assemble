import { describe, expect, it } from "vitest";
import { geminiAdapter } from "../src/adapters/gemini";
import { assembleResponse } from "../src/core/assemble-response";
import {
	expectedVertexEvents,
	normalizeGeminiEvents,
	vertexJSONFixture,
} from "./helpers/gemini-fixtures";

describe("geminiAdapter vertex parseResponse", () => {
	it("LSA-GV71: response-text.json matches expected events", () => {
		const events = normalizeGeminiEvents(
			assembleResponse(vertexJSONFixture("response-text"), geminiAdapter({ apiSurface: "vertex" })),
		);
		expect(events).toEqual(expectedVertexEvents("response-text"));
	});

	it("LSA-GV72: response-tool.json matches expected events", () => {
		const events = normalizeGeminiEvents(
			assembleResponse(vertexJSONFixture("response-tool"), geminiAdapter({ apiSurface: "vertex" })),
		);
		expect(events).toEqual(expectedVertexEvents("response-tool"));
	});

	it("LSA-GV73: response-error.json matches expected events", () => {
		const events = normalizeGeminiEvents(
			assembleResponse(
				vertexJSONFixture("response-error"),
				geminiAdapter({ apiSurface: "vertex" }),
			),
		);
		expect(events).toEqual(expectedVertexEvents("response-error"));
	});

	it("LSA-GV74: response-blocked.json matches expected events", () => {
		const events = normalizeGeminiEvents(
			assembleResponse(
				vertexJSONFixture("response-blocked"),
				geminiAdapter({ apiSurface: "vertex" }),
			),
		);
		expect(events).toEqual(expectedVertexEvents("response-blocked"));
	});

	it("LSA-GV75: response wrapper unwraps before parseResponse mapping", () => {
		const inner = vertexJSONFixture("response-text");
		const events = normalizeGeminiEvents(
			assembleResponse({ response: inner }, geminiAdapter({ apiSurface: "vertex" })),
		);
		expect(events).toEqual(expectedVertexEvents("response-text"));
	});

	it("LSA-GV76: result wrapper unwraps before parseResponse mapping", () => {
		const inner = vertexJSONFixture("response-text");
		const events = normalizeGeminiEvents(
			assembleResponse({ result: inner }, geminiAdapter({ apiSurface: "vertex" })),
		);
		expect(events).toEqual(expectedVertexEvents("response-text"));
	});

	it("LSA-GV77: predictions[0] wrapper unwraps before parseResponse mapping", () => {
		const inner = vertexJSONFixture("response-text");
		const events = normalizeGeminiEvents(
			assembleResponse({ predictions: [inner] }, geminiAdapter({ apiSurface: "vertex" })),
		);
		expect(events).toEqual(expectedVertexEvents("response-text"));
	});
});
