import { describe, expect, it } from "vitest";
import { geminiAdapter } from "../src/adapters/gemini";

const payload = (value: unknown) => JSON.stringify(value);

describe("geminiAdapter parseChunk tools", () => {
	it("LSA-G21: name and explicit id emit tool-start before args", () => {
		expect(
			geminiAdapter().parseChunk(
				payload({
					candidates: [
						{
							index: 0,
							content: { parts: [{ functionCall: { name: "get_weather", id: "call_z" } }] },
						},
					],
				}),
			),
		).toEqual([
			{ kind: "tool-start", id: "call_z", name: "get_weather", index: 0, choiceIndex: 0 },
		]);
	});

	it("LSA-G22: first args delta is full JSON; later chunk may re-emit full args JSON", () => {
		const adapter = geminiAdapter();
		expect(
			adapter.parseChunk(
				payload({
					candidates: [
						{
							index: 0,
							content: {
								parts: [{ functionCall: { name: "merge", id: "call_m", args: { a: 1 } } }],
							},
						},
					],
				}),
			),
		).toEqual([
			{ kind: "tool-start", id: "call_m", name: "merge", index: 0, choiceIndex: 0 },
			{
				kind: "tool-args-delta",
				id: "call_m",
				delta: '{"a":1}',
				index: 0,
				choiceIndex: 0,
			},
			{ kind: "tool-done", id: "call_m", index: 0, choiceIndex: 0 },
		]);

		expect(
			adapter.parseChunk(
				payload({
					candidates: [
						{
							index: 0,
							content: {
								parts: [
									{
										functionCall: { name: "merge", id: "call_m", args: { a: 1, b: 2 } },
									},
								],
							},
						},
					],
				}),
			),
		).toEqual([
			{
				kind: "tool-args-delta",
				id: "call_m",
				delta: '{"a":1,"b":2}',
				index: 0,
				choiceIndex: 0,
			},
			{ kind: "tool-done", id: "call_m", index: 0, choiceIndex: 0 },
		]);
	});

	it("LSA-G23: partialArgs numberValue emits JSON snippet delta", () => {
		expect(
			geminiAdapter().parseChunk(
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
		).toEqual([
			{
				kind: "tool-start",
				id: "gemini:0:0",
				name: "controlLight",
				index: 0,
				choiceIndex: 0,
			},
			{
				kind: "tool-args-delta",
				id: "gemini:0:0",
				delta: '{"brightness":50}',
				index: 0,
				choiceIndex: 0,
			},
		]);
	});

	it("LSA-G24: partialArgs stringValue appends incremental delta", () => {
		const adapter = geminiAdapter();
		adapter.parseChunk(
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
		);

		expect(
			adapter.parseChunk(
				payload({
					candidates: [
						{
							index: 0,
							content: {
								parts: [
									{
										functionCall: {
											name: "controlLight",
											partialArgs: [{ jsonPath: "$.brightness", stringValue: "%" }],
											willContinue: false,
										},
									},
								],
							},
						},
					],
				}),
			),
		).toEqual([
			{
				kind: "tool-args-delta",
				id: "gemini:0:0",
				delta: "%",
				index: 0,
				choiceIndex: 0,
			},
			{ kind: "tool-done", id: "gemini:0:0", index: 0, choiceIndex: 0 },
		]);
	});

	it("LSA-G25: willContinue without partial args keeps tool open", () => {
		expect(
			geminiAdapter().parseChunk(
				payload({
					candidates: [
						{
							index: 0,
							content: {
								parts: [
									{
										functionCall: {
											name: "save",
											id: "call_f",
											args: { ok: true },
											willContinue: true,
										},
									},
								],
							},
						},
					],
				}),
			),
		).toEqual([
			{ kind: "tool-start", id: "call_f", name: "save", index: 0, choiceIndex: 0 },
			{
				kind: "tool-args-delta",
				id: "call_f",
				delta: '{"ok":true}',
				index: 0,
				choiceIndex: 0,
			},
		]);
	});

	it("LSA-G26: parallel functionCalls in one parts array get distinct tools", () => {
		expect(
			geminiAdapter().parseChunk(
				payload({
					candidates: [
						{
							index: 0,
							content: {
								parts: [
									{ functionCall: { name: "search", id: "call_a", args: { q: "a" } } },
									{ functionCall: { name: "search", id: "call_b", args: { q: "b" } } },
								],
							},
						},
					],
				}),
			),
		).toEqual([
			{ kind: "tool-start", id: "call_a", name: "search", index: 0, choiceIndex: 0 },
			{
				kind: "tool-args-delta",
				id: "call_a",
				delta: '{"q":"a"}',
				index: 0,
				choiceIndex: 0,
			},
			{ kind: "tool-done", id: "call_a", index: 0, choiceIndex: 0 },
			{ kind: "tool-start", id: "call_b", name: "search", index: 1, choiceIndex: 0 },
			{
				kind: "tool-args-delta",
				id: "call_b",
				delta: '{"q":"b"}',
				index: 1,
				choiceIndex: 0,
			},
			{ kind: "tool-done", id: "call_b", index: 1, choiceIndex: 0 },
		]);
	});

	it("LSA-G27: follow-up chunk omits name but reconciles by explicit id", () => {
		const adapter = geminiAdapter();
		adapter.parseChunk(
			payload({
				candidates: [
					{
						index: 0,
						content: {
							parts: [{ functionCall: { name: "lookup", id: "call_nba" } }],
						},
					},
				],
			}),
		);

		expect(
			adapter.parseChunk(
				payload({
					candidates: [
						{
							index: 0,
							content: {
								parts: [{ functionCall: { id: "call_nba", args: { id: 42 } } }],
							},
						},
					],
				}),
			),
		).toEqual([
			{
				kind: "tool-args-delta",
				id: "call_nba",
				delta: '{"id":42}',
				index: 0,
				choiceIndex: 0,
			},
			{ kind: "tool-done", id: "call_nba", index: 0, choiceIndex: 0 },
		]);
	});

	it("LSA-G28: synthesized id when omitting explicit id starts gemini:key", () => {
		expect(
			geminiAdapter().parseChunk(
				payload({
					candidates: [
						{
							index: 0,
							content: {
								parts: [{ functionCall: { name: "solo" } }],
							},
						},
					],
				}),
			),
		).toEqual([
			{
				kind: "tool-start",
				id: "gemini:0:0",
				name: "solo",
				index: 0,
				choiceIndex: 0,
			},
		]);
	});

	it("LSA-G29: empty args object still closes tool when name present", () => {
		expect(
			geminiAdapter().parseChunk(
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
		).toEqual([
			{ kind: "tool-start", id: "call_e", name: "noop", index: 0, choiceIndex: 0 },
			{
				kind: "tool-args-delta",
				id: "call_e",
				delta: "{}",
				index: 0,
				choiceIndex: 0,
			},
			{ kind: "tool-done", id: "call_e", index: 0, choiceIndex: 0 },
		]);
	});
});
