import { describe, expect, it } from "vitest";
import { openaiCompatibleAdapter } from "../src/adapters/openai-compatible";

const payload = (value: unknown) => JSON.stringify(value);

describe("openaiCompatibleAdapter host preset parseChunk", () => {
	it("LSA-OC67: deepseek preset maps reasoning_content to reasoning-delta variant detail", () => {
		expect(
			openaiCompatibleAdapter({ provider: "deepseek" }).parseChunk(
				payload({ choices: [{ delta: { reasoning_content: "trace" } }] }),
			),
		).toEqual([{ kind: "reasoning-delta", text: "trace", variant: "detail" }]);
	});

	it("LSA-OC68: mistral preset parses standard text chunk", () => {
		expect(
			openaiCompatibleAdapter({ provider: "mistral" }).parseChunk(
				payload({ choices: [{ delta: { content: "Bonjour" } }] }),
			),
		).toContainEqual({ kind: "text-delta", text: "Bonjour", choiceIndex: 0 });
	});

	it("LSA-OC69: groq preset tolerates missing id model created", () => {
		expect(
			openaiCompatibleAdapter({ provider: "groq" }).parseChunk(
				payload({ choices: [{ delta: { content: "fast" } }] }),
			),
		).toEqual([{ kind: "text-delta", text: "fast", choiceIndex: 0 }]);
	});

	it("LSA-OC70: ollama preset matches groq-like sparse metadata behavior", () => {
		const sparse = payload({ choices: [{ delta: { content: "local" } }] });
		expect(openaiCompatibleAdapter({ provider: "ollama" }).parseChunk(sparse)).toEqual([
			{ kind: "text-delta", text: "local", choiceIndex: 0 },
		]);
		expect(openaiCompatibleAdapter({ provider: "groq" }).parseChunk(sparse)).toEqual([
			{ kind: "text-delta", text: "local", choiceIndex: 0 },
		]);
	});

	it("LSA-OC71: together preset maps reasoning_delta alias while generic does not", () => {
		const reasoningPayload = payload({ choices: [{ delta: { reasoning_delta: "step" } }] });
		expect(openaiCompatibleAdapter({ provider: "generic" }).parseChunk(reasoningPayload)).toEqual(
			[],
		);
		expect(openaiCompatibleAdapter({ provider: "together" }).parseChunk(reasoningPayload)).toEqual([
			{ kind: "reasoning-delta", text: "step", variant: "detail" },
		]);
	});

	it("LSA-OC72: openrouter preset omits thinking alias while generic maps it", () => {
		const thinkingPayload = payload({ choices: [{ delta: { thinking: "router trace" } }] });
		expect(openaiCompatibleAdapter({ provider: "generic" }).parseChunk(thinkingPayload)).toEqual([
			{ kind: "reasoning-delta", text: "router trace", variant: "detail" },
		]);
		expect(openaiCompatibleAdapter({ provider: "openrouter" }).parseChunk(thinkingPayload)).toEqual(
			[],
		);
	});

	it("LSA-OC95: perplexity preset parses standard text chunk", () => {
		expect(
			openaiCompatibleAdapter({ provider: "perplexity" }).parseChunk(
				payload({ choices: [{ delta: { content: "Grounded" } }] }),
			),
		).toContainEqual({ kind: "text-delta", text: "Grounded", choiceIndex: 0 });
	});

	it("LSA-OC96: xai preset parses standard text chunk", () => {
		expect(
			openaiCompatibleAdapter({ provider: "xai" }).parseChunk(
				payload({ choices: [{ delta: { content: "Grok" } }] }),
			),
		).toContainEqual({ kind: "text-delta", text: "Grok", choiceIndex: 0 });
	});

	it("LSA-OC97: xai preset tolerates missing id model created", () => {
		expect(
			openaiCompatibleAdapter({ provider: "xai" }).parseChunk(
				payload({ choices: [{ delta: { content: "sparse" } }] }),
			),
		).toEqual([{ kind: "text-delta", text: "sparse", choiceIndex: 0 }]);
	});

	it("LSA-OC121: azure preset parses standard text chunk with id/model present", () => {
		expect(
			openaiCompatibleAdapter({ provider: "azure" }).parseChunk(
				payload({
					id: "chatcmpl-az",
					model: "gpt-4o-deployment",
					choices: [{ delta: { content: "Azure text" } }],
				}),
			),
		).toContainEqual({ kind: "text-delta", text: "Azure text", choiceIndex: 0 });
	});

	it("LSA-OC122: azure looseErrorShape false rejects loose string error shape", () => {
		const looseError = payload({ error: "something went wrong" });
		expect(openaiCompatibleAdapter({ provider: "azure" }).parseChunk(looseError)).toEqual([]);
		expect(openaiCompatibleAdapter({ provider: "generic" }).parseChunk(looseError)).toContainEqual(
			expect.objectContaining({ kind: "provider-error" }),
		);
	});

	it("LSA-OC149: cloudflare preset parses standard text chunk with id/model present", () => {
		expect(
			openaiCompatibleAdapter({ provider: "cloudflare" }).parseChunk(
				payload({
					id: "cf-chatcmpl-1",
					model: "@cf/meta/llama-3.1-8b-instruct",
					choices: [{ delta: { content: "Workers AI text" } }],
				}),
			),
		).toContainEqual({ kind: "text-delta", text: "Workers AI text", choiceIndex: 0 });
	});

	it("LSA-OC150: cloudflare preset tolerates missing id model created", () => {
		expect(
			openaiCompatibleAdapter({ provider: "cloudflare" }).parseChunk(
				payload({ choices: [{ delta: { content: "sparse cf" } }] }),
			),
		).toEqual([{ kind: "text-delta", text: "sparse cf", choiceIndex: 0 }]);
	});
});
