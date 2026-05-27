import { describe, expect, it } from "vitest";
import { bedrockAdapter } from "../src/adapters/bedrock";

const payload = (value: unknown) => JSON.stringify(value);

describe("bedrockAdapter parseChunk tools", () => {
	it("LSA-B49: contentBlockStart toolUse emits tool-start with id and name", () => {
		expect(
			bedrockAdapter().parseChunk(
				payload({
					contentBlockStart: {
						contentBlockIndex: 0,
						start: { toolUse: { toolUseId: "tool_x", name: "search" } },
					},
				}),
			),
		).toEqual([{ kind: "tool-start", id: "tool_x", name: "search", index: 0, choiceIndex: 0 }]);
	});

	it("LSA-B50: missing toolUseId synthesizes bedrock:block index id", () => {
		expect(
			bedrockAdapter().parseChunk(
				payload({
					contentBlockStart: {
						contentBlockIndex: 2,
						start: { toolUse: { name: "lookup" } },
					},
				}),
			),
		).toEqual([{ kind: "tool-start", id: "bedrock:2", name: "lookup", index: 2, choiceIndex: 0 }]);
	});

	it("LSA-B51: incremental string tool input emits suffix deltas on one adapter instance", () => {
		const adapter = bedrockAdapter();
		adapter.parseChunk(
			payload({
				contentBlockStart: {
					contentBlockIndex: 0,
					start: { toolUse: { toolUseId: "t1", name: "merge" } },
				},
			}),
		);
		expect(
			adapter.parseChunk(
				payload({
					contentBlockDelta: {
						contentBlockIndex: 0,
						delta: { toolUse: { input: '{"a":' } },
					},
				}),
			),
		).toEqual([{ kind: "tool-args-delta", id: "t1", delta: '{"a":', index: 0, choiceIndex: 0 }]);
		expect(
			adapter.parseChunk(
				payload({
					contentBlockDelta: {
						contentBlockIndex: 0,
						delta: { toolUse: { input: '{"a":1}' } },
					},
				}),
			),
		).toEqual([{ kind: "tool-args-delta", id: "t1", delta: "1}", index: 0, choiceIndex: 0 }]);
	});

	it("LSA-B52: tool input object emits full JSON args delta", () => {
		const adapter = bedrockAdapter();
		adapter.parseChunk(
			payload({
				contentBlockStart: {
					contentBlockIndex: 1,
					start: { toolUse: { toolUseId: "t_obj", name: "save" } },
				},
			}),
		);
		expect(
			adapter.parseChunk(
				payload({
					contentBlockDelta: {
						contentBlockIndex: 1,
						delta: { toolUse: { input: { ok: true, n: 2 } } },
					},
				}),
			),
		).toEqual([
			{
				kind: "tool-args-delta",
				id: "t_obj",
				delta: '{"ok":true,"n":2}',
				index: 1,
				choiceIndex: 0,
			},
		]);
	});

	it("LSA-B53: contentBlockStop closes open tool with tool-done", () => {
		const adapter = bedrockAdapter();
		adapter.parseChunk(
			payload({
				contentBlockStart: {
					contentBlockIndex: 0,
					start: { toolUse: { toolUseId: "t_close", name: "fn" } },
				},
			}),
		);
		expect(adapter.parseChunk(payload({ contentBlockStop: { contentBlockIndex: 0 } }))).toEqual([
			{ kind: "tool-done", id: "t_close", index: 0, choiceIndex: 0 },
		]);
	});

	it("LSA-B54: contentBlockStop on block without open tool yields no chunks", () => {
		expect(
			bedrockAdapter().parseChunk(payload({ contentBlockStop: { contentBlockIndex: 9 } })),
		).toEqual([]);
	});

	it("LSA-B55: duplicate tool input string does not emit duplicate delta", () => {
		const adapter = bedrockAdapter();
		adapter.parseChunk(
			payload({
				contentBlockStart: {
					contentBlockIndex: 0,
					start: { toolUse: { toolUseId: "t_dup", name: "fn" } },
				},
			}),
		);
		adapter.parseChunk(
			payload({
				contentBlockDelta: {
					contentBlockIndex: 0,
					delta: { toolUse: { input: '{"x":1}' } },
				},
			}),
		);
		expect(
			adapter.parseChunk(
				payload({
					contentBlockDelta: {
						contentBlockIndex: 0,
						delta: { toolUse: { input: '{"x":1}' } },
					},
				}),
			),
		).toEqual([]);
	});

	it("LSA-B56: parallel block indices keep distinct tool state", () => {
		const adapter = bedrockAdapter();
		adapter.parseChunk(
			payload({
				contentBlockStart: {
					contentBlockIndex: 0,
					start: { toolUse: { toolUseId: "a", name: "one" } },
				},
			}),
		);
		adapter.parseChunk(
			payload({
				contentBlockStart: {
					contentBlockIndex: 1,
					start: { toolUse: { toolUseId: "b", name: "two" } },
				},
			}),
		);
		expect(
			adapter.parseChunk(
				payload({
					contentBlockDelta: { contentBlockIndex: 1, delta: { toolUse: { input: "{}" } } },
				}),
			),
		).toEqual([{ kind: "tool-args-delta", id: "b", delta: "{}", index: 1, choiceIndex: 0 }]);
	});

	it("LSA-B57: tool args delta without prior contentBlockStart yields no chunks", () => {
		expect(
			bedrockAdapter().parseChunk(
				payload({
					contentBlockDelta: {
						contentBlockIndex: 0,
						delta: { toolUse: { input: '{"orphan":true}' } },
					},
				}),
			),
		).toEqual([]);
	});

	it("LSA-B58: contentBlockStart text block emits no chunks until delta", () => {
		expect(
			bedrockAdapter().parseChunk(
				payload({
					contentBlockStart: {
						contentBlockIndex: 0,
						start: { text: "prefix" },
					},
				}),
			),
		).toEqual([]);
	});
});
