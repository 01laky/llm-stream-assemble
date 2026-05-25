import { describe, expect, it } from "vitest";
import { openaiResponsesAdapter } from "../src/adapters/openai-responses";

const payload = (value: unknown) => JSON.stringify(value);

describe("openaiResponsesAdapter tool events", () => {
	it("LSA-R11: output_item.added function_call emits tool-start", () => {
		expect(
			openaiResponsesAdapter().parseChunk(
				payload({
					type: "response.output_item.added",
					output_index: 0,
					item: { id: "fc_1", type: "function_call", call_id: "call_1", name: "search" },
				}),
			),
		).toEqual([{ kind: "tool-start", id: "call_1", name: "search", index: 0 }]);
	});

	it("LSA-R12: function_call_arguments.delta emits args delta", () => {
		expect(
			openaiResponsesAdapter().parseChunk(
				payload({ type: "response.function_call_arguments.delta", call_id: "call_1", delta: "{}" }),
			),
		).toEqual([
			{ kind: "tool-start", id: "call_1", name: "unknown" },
			{ kind: "tool-args-delta", id: "call_1", delta: "{}" },
		]);
	});

	it("LSA-R13: function_call_arguments.done emits tool-done", () => {
		expect(
			openaiResponsesAdapter().parseChunk(
				payload({
					type: "response.function_call_arguments.done",
					call_id: "call_1",
					arguments: "{}",
				}),
			),
		).toEqual([
			{ kind: "tool-start", id: "call_1", name: "unknown" },
			{ kind: "tool-args-delta", id: "call_1", delta: "{}" },
			{ kind: "tool-done", id: "call_1" },
		]);
	});

	it("LSA-R14: output_item.done emits tool-done if args done missing", () => {
		const adapter = openaiResponsesAdapter();
		adapter.parseChunk(
			payload({
				type: "response.output_item.added",
				output_index: 0,
				item: { id: "fc_1", type: "function_call", name: "search" },
			}),
		);
		expect(
			adapter.parseChunk(
				payload({
					type: "response.output_item.done",
					output_index: 0,
					item: { id: "fc_1", type: "function_call" },
				}),
			),
		).toEqual([{ kind: "tool-done", id: "fc_1", index: 0 }]);
	});

	it("LSA-R15: args before item emits unknown tool-start", () => {
		expect(
			openaiResponsesAdapter().parseChunk(
				payload({
					type: "response.function_call_arguments.delta",
					item_id: "fc_late",
					output_index: 0,
					delta: "{}",
				}),
			),
		).toEqual([
			{ kind: "tool-start", id: "fc_late", name: "unknown", index: 0 },
			{ kind: "tool-args-delta", id: "fc_late", delta: "{}", index: 0 },
		]);
	});

	it("LSA-R16: duplicate item/done does not duplicate start/done", () => {
		const adapter = openaiResponsesAdapter();
		const added = payload({
			type: "response.output_item.added",
			output_index: 0,
			item: { id: "fc_1", type: "function_call", name: "search" },
		});
		expect(adapter.parseChunk(added)).toHaveLength(1);
		expect(adapter.parseChunk(added)).toEqual([]);
		const done = payload({ type: "response.function_call_arguments.done", item_id: "fc_1" });
		expect(adapter.parseChunk(done)).toEqual([{ kind: "tool-done", id: "fc_1", index: 0 }]);
		expect(adapter.parseChunk(done)).toEqual([]);
	});

	it("LSA-R17: id tracking works by call_id", () => {
		const adapter = openaiResponsesAdapter();
		adapter.parseChunk(
			payload({
				type: "response.output_item.added",
				item: { id: "fc_1", type: "function_call", call_id: "call_1", name: "search" },
			}),
		);
		expect(
			adapter.parseChunk(
				payload({ type: "response.function_call_arguments.delta", call_id: "call_1", delta: "{}" }),
			),
		).toEqual([{ kind: "tool-args-delta", id: "call_1", delta: "{}" }]);
	});

	it("LSA-R18: id tracking works by item_id", () => {
		expect(
			openaiResponsesAdapter().parseChunk(
				payload({ type: "response.function_call_arguments.delta", item_id: "fc_1", delta: "{}" }),
			),
		).toEqual([
			{ kind: "tool-start", id: "fc_1", name: "unknown" },
			{ kind: "tool-args-delta", id: "fc_1", delta: "{}" },
		]);
	});

	it("LSA-R19: id tracking falls back to output_index", () => {
		expect(
			openaiResponsesAdapter().parseChunk(
				payload({ type: "response.function_call_arguments.delta", output_index: 2, delta: "{}" }),
			),
		).toEqual([
			{ kind: "tool-start", id: "response_tool:2", name: "unknown", index: 2 },
			{ kind: "tool-args-delta", id: "response_tool:2", delta: "{}", index: 2 },
		]);
	});

	it("LSA-R20: final args in done are not duplicated if deltas already seen", () => {
		const adapter = openaiResponsesAdapter();
		adapter.parseChunk(
			payload({
				type: "response.function_call_arguments.delta",
				call_id: "call_1",
				delta: '{"a":',
			}),
		);
		expect(
			adapter.parseChunk(
				payload({
					type: "response.function_call_arguments.done",
					call_id: "call_1",
					arguments: '{"a":1}',
				}),
			),
		).toEqual([
			{ kind: "tool-args-delta", id: "call_1", delta: "1}" },
			{ kind: "tool-done", id: "call_1" },
		]);
	});

	it("LSA-R20b: initial item.arguments emits one args delta", () => {
		expect(
			openaiResponsesAdapter().parseChunk(
				payload({
					type: "response.output_item.added",
					output_index: 0,
					item: { id: "fc_1", type: "function_call", name: "search", arguments: "{}" },
				}),
			),
		).toEqual([
			{ kind: "tool-start", id: "fc_1", name: "search", index: 0 },
			{ kind: "tool-args-delta", id: "fc_1", delta: "{}", index: 0 },
		]);
	});

	it("LSA-R20c: output_item.delta function call arguments are handled", () => {
		expect(
			openaiResponsesAdapter().parseChunk(
				payload({
					type: "response.output_item.delta",
					item_id: "fc_1",
					delta: { arguments: "{}" },
				}),
			),
		).toEqual([
			{ kind: "tool-start", id: "fc_1", name: "unknown" },
			{ kind: "tool-args-delta", id: "fc_1", delta: "{}" },
		]);
	});

	it("LSA-R20d: parallel function calls keep separate state", () => {
		const adapter = openaiResponsesAdapter();
		adapter.parseChunk(
			payload({
				type: "response.function_call_arguments.delta",
				call_id: "a",
				output_index: 0,
				delta: '{"a":1}',
			}),
		);
		adapter.parseChunk(
			payload({
				type: "response.function_call_arguments.delta",
				call_id: "b",
				output_index: 1,
				delta: '{"b":2}',
			}),
		);
		expect(
			adapter.parseChunk(payload({ type: "response.function_call_arguments.done", call_id: "a" })),
		).toEqual([{ kind: "tool-done", id: "a", index: 0 }]);
		expect(
			adapter.parseChunk(payload({ type: "response.function_call_arguments.done", call_id: "b" })),
		).toEqual([{ kind: "tool-done", id: "b", index: 1 }]);
	});

	it("LSA-R20e: new adapter instance starts with empty metadata/tool state", () => {
		const first = openaiResponsesAdapter();
		first.parseChunk(payload({ type: "response.created", response: { id: "one" } }));
		const second = openaiResponsesAdapter();
		expect(
			second.parseChunk(payload({ type: "response.created", response: { id: "two" } }))[0],
		).toEqual({
			kind: "message-start",
			id: "two",
		});
	});
});
