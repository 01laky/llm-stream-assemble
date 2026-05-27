import { describe, expect, it } from "vitest";
import { openaiChatAdapter } from "../src/adapters/openai-chat";
import { assembleFromPayloads } from "../src/core/assemble-payloads";
import { collectAsync } from "./helpers/collect-events";

const payload = (value: unknown) => JSON.stringify(value);

describe("openaiChatAdapter edge cases", () => {
	it("LSA-OC229: empty or whitespace SSE payload line yields no chunks", () => {
		expect(openaiChatAdapter().parseChunk("")).toEqual([]);
		expect(openaiChatAdapter().parseChunk("   ")).toEqual([]);
	});

	it("LSA-OC230: [DONE] marker yields no chunks", () => {
		expect(openaiChatAdapter().parseChunk("[DONE]")).toEqual([]);
	});

	it("LSA-OC231: malformed JSON throws openaiChatAdapter.parseChunk prefix", () => {
		expect(() => openaiChatAdapter().parseChunk("{")).toThrow(/openaiChatAdapter\.parseChunk/);
	});

	it("LSA-OC232: non-object JSON throws expected object error", () => {
		expect(() => openaiChatAdapter().parseChunk(JSON.stringify(null))).toThrow(
			/expected a JSON object/,
		);
	});

	it("LSA-OC233: finish_reason stop terminates stream and drops trailing deltas", async () => {
		async function* payloads() {
			yield payload({
				id: "c1",
				object: "chat.completion.chunk",
				choices: [{ index: 0, delta: { content: "ok" }, finish_reason: null }],
			});
			yield payload({
				id: "c1",
				object: "chat.completion.chunk",
				choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
			});
			yield payload({
				id: "c1",
				object: "chat.completion.chunk",
				choices: [{ index: 0, delta: { content: "nope" }, finish_reason: null }],
			});
		}
		const events = await collectAsync(assembleFromPayloads(payloads(), openaiChatAdapter()));
		expect(events.filter((event) => event.type === "text.delta")).toHaveLength(1);
	});
});
