import { describe, expect, it } from "vitest";
import {
	openaiCompatibleAdapter,
	type OpenAICompatibleProvider,
} from "../src/adapters/openai-compatible";

const payload = (value: unknown) => JSON.stringify(value);

describe("openaiCompatibleAdapter dialect options", () => {
	it("LSA-OC07: missing metadata is tolerated by default", () => {
		expect(
			openaiCompatibleAdapter().parseChunk(
				payload({ choices: [{ delta: { content: "local" }, finish_reason: "stop" }] }),
			),
		).toContainEqual({ kind: "text-delta", text: "local", choiceIndex: 0 });
	});

	it("LSA-OC08: missing metadata emits no metadata chunk", () => {
		expect(
			openaiCompatibleAdapter()
				.parseChunk(payload({ choices: [{ delta: { content: "local" } }] }))
				.some((chunk) => chunk.kind === "metadata"),
		).toBe(false);
	});

	it("LSA-OC09: missing choice index falls back to array position", () => {
		expect(
			openaiCompatibleAdapter().parseChunk(
				payload({ choices: [{ delta: { content: "a" } }, { delta: { content: "b" } }] }),
			),
		).toEqual([
			{ kind: "text-delta", text: "a", choiceIndex: 0 },
			{ kind: "text-delta", text: "b", choiceIndex: 1 },
		]);
	});

	it("LSA-OC10: disabling choice fallback omits public choiceIndex", () => {
		expect(
			openaiCompatibleAdapter({ useChoicePositionFallback: false }).parseChunk(
				payload({ choices: [{ delta: { content: "a" } }] }),
			),
		).toEqual([{ kind: "text-delta", text: "a" }]);
	});

	it("LSA-OC11: missing tool id still emits tool chunks with index", () => {
		expect(
			openaiCompatibleAdapter().parseChunk(
				payload({
					choices: [
						{
							delta: {
								tool_calls: [{ index: 0, function: { name: "lookup", arguments: "{}" } }],
							},
						},
					],
				}),
			),
		).toEqual([
			{ kind: "tool-start", name: "lookup", index: 0, choiceIndex: 0 },
			{ kind: "tool-args-delta", delta: "{}", index: 0, choiceIndex: 0 },
		]);
	});

	it("LSA-OC12: args before name emits tool-start with unknown", () => {
		expect(
			openaiCompatibleAdapter().parseChunk(
				payload({
					choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: "{}" } }] } }],
				}),
			),
		).toEqual([
			{ kind: "tool-start", name: "unknown", index: 0, choiceIndex: 0 },
			{ kind: "tool-args-delta", delta: "{}", index: 0, choiceIndex: 0 },
		]);
	});

	it("LSA-OC13: ollama preset tolerates missing metadata", () => {
		expect(
			openaiCompatibleAdapter({ provider: "ollama" }).parseChunk(
				payload({ choices: [{ delta: { content: "ollama" } }] }),
			),
		).toEqual([{ kind: "text-delta", text: "ollama", choiceIndex: 0 }]);
	});

	it("LSA-OC14: openrouter preset preserves standard OpenAI behavior", () => {
		expect(
			openaiCompatibleAdapter({ provider: "openrouter" }).parseChunk(
				payload({ id: "or_1", model: "openrouter/model", choices: [] }),
			)[0],
		).toEqual({ kind: "message-start", id: "or_1" });
	});

	it("LSA-OC14b: strict missing metadata rejects unrecognizable payloads", () => {
		expect(() =>
			openaiCompatibleAdapter({ allowMissingMetadata: false }).parseChunk(payload({ foo: "bar" })),
		).toThrow(/^llm-stream-assemble: openaiCompatibleAdapter\.parseChunk/);
	});

	it("LSA-OC14c: every provider preset parses a generic text chunk", () => {
		const providers: OpenAICompatibleProvider[] = [
			"generic",
			"openrouter",
			"groq",
			"deepseek",
			"mistral",
			"ollama",
			"lmstudio",
			"together",
			"fireworks",
			"perplexity",
			"xai",
			"azure",
			"cloudflare",
		];
		for (const provider of providers) {
			expect(
				openaiCompatibleAdapter({ provider }).parseChunk(
					payload({ choices: [{ delta: { content: provider } }] }),
				),
			).toContainEqual({ kind: "text-delta", text: provider, choiceIndex: 0 });
		}
	});
});
