import { describe, expect, it } from "vitest";
import { openaiResponsesAdapter } from "../src/adapters/openai-responses";
import { assembleFromPayloads } from "../src/core/assemble-payloads";
import { collectAsync } from "./helpers/collect-events";

const payload = (value: unknown) => JSON.stringify(value);

describe("openaiResponsesAdapter edge cases", () => {
	it("LSA-R33: empty or whitespace line yields no chunks", () => {
		expect(openaiResponsesAdapter().parseChunk("")).toEqual([]);
		expect(openaiResponsesAdapter().parseChunk("   ")).toEqual([]);
	});

	it("LSA-R34: [DONE] marker yields no chunks", () => {
		expect(openaiResponsesAdapter().parseChunk("[DONE]")).toEqual([]);
	});

	it("LSA-R35: non-object JSON throws scoped expected object error", () => {
		expect(() => openaiResponsesAdapter().parseChunk(JSON.stringify(42))).toThrow(
			/openaiResponsesAdapter\.parseChunk: expected a JSON object/,
		);
	});

	it("LSA-R36: error payload maps provider-error and finish error", () => {
		const chunks = openaiResponsesAdapter().parseChunk(
			payload({ type: "error", error: { message: "bad key" } }),
		);
		expect(chunks).toHaveLength(2);
		expect(chunks[0]?.kind).toBe("provider-error");
		expect(chunks[1]).toEqual({ kind: "finish", reason: "error" });
	});

	it("LSA-R37: response.failed emits provider error finish", () => {
		const chunks = openaiResponsesAdapter().parseChunk(
			payload({
				type: "response.failed",
				response: { error: { message: "model failed" } },
			}),
		);
		expect(chunks.some((chunk) => chunk.kind === "provider-error")).toBe(true);
		expect(chunks).toContainEqual({ kind: "finish", reason: "error" });
	});

	it("LSA-R38: response.incomplete emits finish incomplete", () => {
		const chunks = openaiResponsesAdapter().parseChunk(
			payload({
				type: "response.incomplete",
				response: { usage: { input_tokens: 1, output_tokens: 0 } },
			}),
		);
		expect(chunks).toContainEqual({ kind: "finish", reason: "incomplete" });
	});

	it("LSA-R39: unknown event type falls through to reasoningChunks when fields present", () => {
		expect(
			openaiResponsesAdapter().parseChunk(
				payload({ type: "response.custom.reasoning", reasoning: "hidden" }),
			),
		).toEqual([{ kind: "reasoning-delta", text: "hidden", variant: "detail" }]);
	});

	it("LSA-R40: assembler drops post-finish usage tail", async () => {
		async function* payloads() {
			yield payload({ type: "response.output_text.delta", delta: "x" });
			yield payload({ type: "response.completed", response: { usage: { input_tokens: 1 } } });
			yield payload({
				type: "response.output_text.delta",
				delta: "late",
			});
		}
		const events = await collectAsync(assembleFromPayloads(payloads(), openaiResponsesAdapter()));
		expect(events.filter((event) => event.type === "text.delta").length).toBe(1);
	});
});
