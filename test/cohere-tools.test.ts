import { describe, expect, it } from "vitest";
import { cohereAdapter } from "../src/adapters/cohere";

const payload = (value: unknown) => JSON.stringify(value);

describe("cohereAdapter parseChunk tools", () => {
	it("LSA-CO49: tool-call-start emits tool-start with id and name", () => {
		expect(
			cohereAdapter().parseChunk(
				payload({
					type: "tool-call-start",
					index: 0,
					delta: {
						message: {
							tool_calls: {
								id: "tool_x",
								type: "function",
								function: { name: "search", arguments: "" },
							},
						},
					},
				}),
			),
		).toEqual([{ kind: "tool-start", id: "tool_x", name: "search", index: 0, choiceIndex: 0 }]);
	});

	it("LSA-CO50: missing tool id synthesizes cohere:tool index id", () => {
		expect(
			cohereAdapter().parseChunk(
				payload({
					type: "tool-call-start",
					index: 2,
					delta: {
						message: {
							tool_calls: {
								type: "function",
								function: { name: "lookup", arguments: "" },
							},
						},
					},
				}),
			),
		).toEqual([
			{ kind: "tool-start", id: "cohere:tool:2", name: "lookup", index: 2, choiceIndex: 0 },
		]);
	});

	it("LSA-CO51: incremental string tool input emits suffix deltas on one adapter instance", () => {
		const adapter = cohereAdapter();
		adapter.parseChunk(
			payload({
				type: "tool-call-start",
				index: 0,
				delta: {
					message: {
						tool_calls: {
							id: "t1",
							type: "function",
							function: { name: "merge", arguments: "" },
						},
					},
				},
			}),
		);
		expect(
			adapter.parseChunk(
				payload({
					type: "tool-call-delta",
					index: 0,
					delta: {
						message: {
							tool_calls: {
								function: { arguments: '{"a":' },
							},
						},
					},
				}),
			),
		).toEqual([{ kind: "tool-args-delta", id: "t1", delta: '{"a":', index: 0, choiceIndex: 0 }]);
		expect(
			adapter.parseChunk(
				payload({
					type: "tool-call-delta",
					index: 0,
					delta: {
						message: {
							tool_calls: {
								function: { arguments: '{"a":1}' },
							},
						},
					},
				}),
			),
		).toEqual([{ kind: "tool-args-delta", id: "t1", delta: "1}", index: 0, choiceIndex: 0 }]);
	});

	it("LSA-CO52: tool-call-start with partial arguments emits args on follow-up delta", () => {
		const adapter = cohereAdapter();
		expect(
			adapter.parseChunk(
				payload({
					type: "tool-call-start",
					index: 1,
					delta: {
						message: {
							tool_calls: {
								id: "t_obj",
								type: "function",
								function: { name: "save", arguments: '{"ok":' },
							},
						},
					},
				}),
			),
		).toEqual([{ kind: "tool-start", id: "t_obj", name: "save", index: 1, choiceIndex: 0 }]);
		expect(
			adapter.parseChunk(
				payload({
					type: "tool-call-delta",
					index: 1,
					delta: {
						message: {
							tool_calls: {
								id: "t_obj",
								function: { arguments: '{"ok":true,"n":2}' },
							},
						},
					},
				}),
			),
		).toEqual([
			{
				kind: "tool-args-delta",
				id: "t_obj",
				delta: 'true,"n":2}',
				index: 1,
				choiceIndex: 0,
			},
		]);
	});

	it("LSA-CO53: tool-call-end closes open tool with tool-done", () => {
		const adapter = cohereAdapter();
		adapter.parseChunk(
			payload({
				type: "tool-call-start",
				index: 0,
				delta: {
					message: {
						tool_calls: {
							id: "t_close",
							type: "function",
							function: { name: "fn", arguments: "" },
						},
					},
				},
			}),
		);
		expect(adapter.parseChunk(payload({ type: "tool-call-end", index: 0 }))).toEqual([
			{ kind: "tool-done", id: "t_close", index: 0, choiceIndex: 0 },
		]);
	});

	it("LSA-CO54: tool-call-end on block without open tool yields no chunks", () => {
		expect(cohereAdapter().parseChunk(payload({ type: "tool-call-end", index: 9 }))).toEqual([]);
	});

	it("LSA-CO55: duplicate tool input string does not emit duplicate delta", () => {
		const adapter = cohereAdapter();
		adapter.parseChunk(
			payload({
				type: "tool-call-start",
				index: 0,
				delta: {
					message: {
						tool_calls: {
							id: "t_dup",
							type: "function",
							function: { name: "fn", arguments: "" },
						},
					},
				},
			}),
		);
		adapter.parseChunk(
			payload({
				type: "tool-call-delta",
				index: 0,
				delta: {
					message: {
						tool_calls: {
							function: { arguments: '{"x":1}' },
						},
					},
				},
			}),
		);
		expect(
			adapter.parseChunk(
				payload({
					type: "tool-call-delta",
					index: 0,
					delta: {
						message: {
							tool_calls: {
								function: { arguments: '{"x":1}' },
							},
						},
					},
				}),
			),
		).toEqual([]);
	});

	it("LSA-CO56: parallel tool indices keep distinct tool state", () => {
		const adapter = cohereAdapter();
		adapter.parseChunk(
			payload({
				type: "tool-call-start",
				index: 0,
				delta: {
					message: {
						tool_calls: [
							{
								id: "a",
								type: "function",
								function: { name: "one", arguments: "" },
							},
							{
								id: "b",
								type: "function",
								function: { name: "two", arguments: "" },
							},
						],
					},
				},
			}),
		);
		expect(
			adapter.parseChunk(
				payload({
					type: "tool-call-delta",
					index: 1,
					delta: {
						message: {
							tool_calls: {
								id: "b",
								function: { arguments: "{}" },
							},
						},
					},
				}),
			),
		).toEqual([{ kind: "tool-args-delta", id: "b", delta: "{}", index: 1, choiceIndex: 0 }]);
	});

	it("LSA-CO57: tool-call-delta without prior start synthesizes tool-start", () => {
		expect(
			cohereAdapter().parseChunk(
				payload({
					type: "tool-call-delta",
					index: 0,
					delta: {
						message: {
							tool_calls: {
								id: "orphan",
								type: "function",
								function: { name: "solo", arguments: '{"orphan":true}' },
							},
						},
					},
				}),
			),
		).toEqual([
			{ kind: "tool-start", id: "orphan", name: "solo", index: 0, choiceIndex: 0 },
			{
				kind: "tool-args-delta",
				id: "orphan",
				delta: '{"orphan":true}',
				index: 0,
				choiceIndex: 0,
			},
		]);
	});

	it("LSA-CO58: content-start and content-end emit no chunks", () => {
		expect(cohereAdapter().parseChunk(payload({ type: "content-start", index: 0 }))).toEqual([]);
		expect(cohereAdapter().parseChunk(payload({ type: "content-end", index: 0 }))).toEqual([]);
	});
});
