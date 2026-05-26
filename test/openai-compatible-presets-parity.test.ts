import { describe, expect, it } from "vitest";
import { openaiChatAdapter } from "../src/adapters/openai-chat";
import { openaiCompatibleAdapter } from "../src/adapters/openai-compatible";
import { assembleStream } from "../src/core/assemble-stream";
import { byteStreamFromStrings, collectAsync } from "./helpers/collect-events";
import { hostCompatibleFixture, normalizeCompatibleEvents } from "./helpers/compatible-fixtures";

const payload = (value: unknown) => JSON.stringify(value);

describe("openaiCompatibleAdapter cross-preset parity", () => {
	it("LSA-OC77: thinking_content — generic maps, deepseek preset omits alias", () => {
		const reasoningPayload = payload({
			choices: [{ delta: { thinking_content: "Let me think…" } }],
		});
		expect(openaiCompatibleAdapter({ provider: "generic" }).parseChunk(reasoningPayload)).toEqual([
			{ kind: "reasoning-delta", text: "Let me think…", variant: "detail" },
		]);
		expect(openaiCompatibleAdapter({ provider: "deepseek" }).parseChunk(reasoningPayload)).toEqual(
			[],
		);
	});

	it("LSA-OC78: reasoning_delta — generic silent, together maps", () => {
		const reasoningPayload = payload({ choices: [{ delta: { reasoning_delta: "step one" } }] });
		expect(openaiCompatibleAdapter({ provider: "generic" }).parseChunk(reasoningPayload)).toEqual(
			[],
		);
		expect(openaiCompatibleAdapter({ provider: "together" }).parseChunk(reasoningPayload)).toEqual([
			{ kind: "reasoning-delta", text: "step one", variant: "detail" },
		]);
	});

	it("LSA-OC79: thinking — generic maps, openrouter preset omits alias", () => {
		const reasoningPayload = payload({ choices: [{ delta: { thinking: "router trace" } }] });
		expect(openaiCompatibleAdapter({ provider: "generic" }).parseChunk(reasoningPayload)).toEqual([
			{ kind: "reasoning-delta", text: "router trace", variant: "detail" },
		]);
		expect(
			openaiCompatibleAdapter({ provider: "openrouter" }).parseChunk(reasoningPayload),
		).toEqual([]);
	});

	it("LSA-OC101: sparse metadata — generic, perplexity, and xai emit identical text-delta", () => {
		const sparse = payload({ choices: [{ delta: { content: "same" } }] });
		const expected = [{ kind: "text-delta", text: "same", choiceIndex: 0 }];
		for (const provider of ["generic", "perplexity", "xai"] as const) {
			expect(openaiCompatibleAdapter({ provider }).parseChunk(sparse)).toEqual(expected);
		}
	});

	it("LSA-OC111: xai reasoning_content — generic and xai preset both emit reasoning-delta", () => {
		const reasoningPayload = payload({
			choices: [{ delta: { reasoning_content: "Thinking step" } }],
		});
		const expected = [{ kind: "reasoning-delta", text: "Thinking step", variant: "detail" }];
		expect(openaiCompatibleAdapter({ provider: "generic" }).parseChunk(reasoningPayload)).toEqual(
			expected,
		);
		expect(openaiCompatibleAdapter({ provider: "xai" }).parseChunk(reasoningPayload)).toEqual(
			expected,
		);
	});

	it("LSA-OC127: azure text-basic matches openaiChatAdapter normalized stream events", async () => {
		const sse = hostCompatibleFixture("azure", "text-basic", "sse") as string;
		const azureEvents = normalizeCompatibleEvents(
			await collectAsync(
				assembleStream(byteStreamFromStrings(sse), openaiCompatibleAdapter({ provider: "azure" })),
			),
		);
		const chatEvents = normalizeCompatibleEvents(
			await collectAsync(assembleStream(byteStreamFromStrings(sse), openaiChatAdapter())),
		);
		expect(azureEvents).toEqual(chatEvents);
	});

	it("LSA-OC128: azure vs generic on strict-valid payload — identical text-delta", () => {
		const valid = payload({
			id: "chatcmpl-az",
			model: "gpt-4o-deployment",
			choices: [{ delta: { content: "same" } }],
		});
		const textDelta = { kind: "text-delta", text: "same", choiceIndex: 0 };
		expect(openaiCompatibleAdapter({ provider: "azure" }).parseChunk(valid)).toContainEqual(
			textDelta,
		);
		expect(openaiCompatibleAdapter({ provider: "generic" }).parseChunk(valid)).toContainEqual(
			textDelta,
		);
	});

	it("LSA-OC129: azure vs generic on unrecognizable payload — generic silent, azure throws", () => {
		const unrecognizable = payload({ foo: "bar" });
		expect(openaiCompatibleAdapter({ provider: "generic" }).parseChunk(unrecognizable)).toEqual([]);
		expect(() => openaiCompatibleAdapter({ provider: "azure" }).parseChunk(unrecognizable)).toThrow(
			/openaiCompatibleAdapter\.parseChunk/,
		);
	});

	it("LSA-OC139: azure usage-stream matches openaiChatAdapter usage events", async () => {
		const sse = hostCompatibleFixture("azure", "usage-stream", "sse") as string;
		const azureEvents = normalizeCompatibleEvents(
			await collectAsync(
				assembleStream(byteStreamFromStrings(sse), openaiCompatibleAdapter({ provider: "azure" })),
			),
		);
		const chatEvents = normalizeCompatibleEvents(
			await collectAsync(assembleStream(byteStreamFromStrings(sse), openaiChatAdapter())),
		);
		expect(azureEvents.filter((event) => (event as { type?: string }).type === "usage")).toEqual(
			chatEvents.filter((event) => (event as { type?: string }).type === "usage"),
		);
	});
});
