import { describe, expect, it } from "vitest";
import { geminiAdapter } from "../src/adapters/gemini";
import {
	assembleVertexJsonl,
	expectedVertexEvents,
	normalizeGeminiEvents,
} from "./helpers/gemini-fixtures";

const vertex = () => geminiAdapter({ apiSurface: "vertex" });
const payload = (value: unknown) => JSON.stringify(value);

describe("geminiAdapter vertex tools golden streams", () => {
	const toolFixtures = [
		["tool-single", "LSA-GV51"],
		["tool-parallel", "LSA-GV52"],
		["tool-partial-args", "LSA-GV53"],
		["tool-name-before-args", "LSA-GV54"],
		["tool-flush-without-terminal", "LSA-GV55"],
		["tool-args-object", "LSA-GV56"],
	] as const;

	it.each(toolFixtures)("%s assembles expected tool events (%s)", async (name) => {
		expect(normalizeGeminiEvents(await assembleVertexJsonl(name))).toEqual(
			expectedVertexEvents(name),
		);
	});
});

describe("geminiAdapter vertex parseChunk tools", () => {
	it("LSA-GV57: wrapped response tool call emits tool-start", () => {
		expect(
			vertex().parseChunk(
				payload({
					response: {
						candidates: [
							{
								index: 0,
								content: { parts: [{ functionCall: { name: "fn", id: "v57" } }] },
							},
						],
					},
				}),
			),
		).toContainEqual({
			kind: "tool-start",
			id: "v57",
			name: "fn",
			index: 0,
			choiceIndex: 0,
		});
	});

	it("LSA-GV58: partialArgs on vertex surface matches google-ai mapping", () => {
		expect(
			vertex().parseChunk(
				payload({
					candidates: [
						{
							index: 0,
							content: {
								parts: [
									{
										functionCall: {
											name: "controlLight",
											partialArgs: [{ jsonPath: "$.brightness", numberValue: 50 }],
											willContinue: true,
										},
									},
								],
							},
						},
					],
				}),
			),
		).toContainEqual({
			kind: "tool-args-delta",
			id: "gemini:0:0",
			delta: '{"brightness":50}',
			index: 0,
			choiceIndex: 0,
		});
	});

	it("LSA-GV59: parallel functionCalls get distinct tool indices", () => {
		const chunks = vertex().parseChunk(
			payload({
				candidates: [
					{
						index: 0,
						content: {
							parts: [
								{ functionCall: { name: "a", id: "call_a", args: { q: "1" } } },
								{ functionCall: { name: "b", id: "call_b", args: { q: "2" } } },
							],
						},
					},
				],
			}),
		);
		expect(chunks.filter((c) => c.kind === "tool-start")).toHaveLength(2);
	});

	it("LSA-GV60: empty args object closes tool on vertex surface", () => {
		expect(
			vertex().parseChunk(
				payload({
					candidates: [
						{
							index: 0,
							content: {
								parts: [{ functionCall: { name: "noop", id: "call_e", args: {} } }],
							},
						},
					],
				}),
			),
		).toContainEqual({ kind: "tool-done", id: "call_e", index: 0, choiceIndex: 0 });
	});
});
