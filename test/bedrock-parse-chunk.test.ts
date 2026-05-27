import { describe, expect, it } from "vitest";
import { bedrockAdapter } from "../src/adapters/bedrock";

const payload = (value: unknown) => JSON.stringify(value);

describe("bedrockAdapter parseChunk unit", () => {
	it("LSA-B23: messageStart emits message-start and metadata", () => {
		expect(bedrockAdapter().parseChunk(payload({ messageStart: { role: "assistant" } }))).toEqual([
			{ kind: "message-start" },
			{ kind: "metadata", raw: { role: "assistant" } },
		]);
	});

	it("LSA-B24: contentBlockDelta text emits text-delta", () => {
		expect(
			bedrockAdapter().parseChunk(
				payload({ contentBlockDelta: { contentBlockIndex: 0, delta: { text: "Hi" } } }),
			),
		).toEqual([{ kind: "text-delta", text: "Hi", choiceIndex: 0 }]);
	});

	it("LSA-B25: contentBlockDelta tool input emits tool-args-delta", () => {
		const adapter = bedrockAdapter();
		adapter.parseChunk(
			payload({
				contentBlockStart: {
					contentBlockIndex: 0,
					start: { toolUse: { toolUseId: "t1", name: "search" } },
				},
			}),
		);
		expect(
			adapter.parseChunk(
				payload({
					contentBlockDelta: { contentBlockIndex: 0, delta: { toolUse: { input: '{"q":' } } },
				}),
			),
		).toEqual([
			{
				kind: "tool-args-delta",
				id: "t1",
				delta: '{"q":',
				index: 0,
				choiceIndex: 0,
			},
		]);
	});

	it("LSA-B26: messageStop emits finish chunk", () => {
		expect(
			bedrockAdapter().parseChunk(payload({ messageStop: { stopReason: "end_turn" } })),
		).toEqual([
			{ kind: "metadata", raw: { stopReason: "end_turn" } },
			{ kind: "finish", reason: "stop", choiceIndex: 0 },
		]);
	});

	it("LSA-B79: jsonMode maps contentBlockDelta text to json-delta", () => {
		expect(
			bedrockAdapter({ jsonMode: true }).parseChunk(
				payload({
					contentBlockDelta: { contentBlockIndex: 0, delta: { text: '{"k":' } },
				}),
			),
		).toEqual([{ kind: "json-delta", delta: '{"k":' }]);
	});

	it("LSA-B80: metadata-only chunk with empty usage object yields no usage chunk", () => {
		expect(bedrockAdapter().parseChunk(payload({ metadata: { usage: {} } }))).toEqual([]);
	});
});
