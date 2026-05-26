import { expect } from "vitest";
import { openaiCompatibleAdapter } from "../../src/adapters/openai-compatible";
import {
	isStrictCompatiblePreset,
	type OpenAICompatibleProvider,
} from "../../src/adapters/openai-compatible-presets";
import { LOOSE_HOST_PRESETS } from "../../src/adapters/openai-compatible-presets";

export { LOOSE_HOST_PRESETS };

export function jsonPayload(value: unknown): string {
	return JSON.stringify(value);
}

export function firstSseDataLine(
	sse: string,
	predicate: (line: string) => boolean = (line) =>
		line.startsWith("data: ") && !line.includes("[DONE]"),
): string {
	const line = sse.split("\n").find(predicate);
	if (!line) throw new Error("No matching SSE data line found");
	return line.slice("data: ".length);
}

export function assertMalformedJsonPrefix(provider: OpenAICompatibleProvider): void {
	expect(() => openaiCompatibleAdapter({ provider }).parseChunk("{bad-json")).toThrow(
		/^llm-stream-assemble: openaiCompatibleAdapter\.parseChunk/,
	);
}

export function assertEmptyObjectBehavior(provider: OpenAICompatibleProvider): void {
	const empty = jsonPayload({});
	if (isStrictCompatiblePreset(provider)) {
		expect(() => openaiCompatibleAdapter({ provider }).parseChunk(empty)).toThrow(
			/openaiCompatibleAdapter\.parseChunk/,
		);
		return;
	}
	expect(openaiCompatibleAdapter({ provider }).parseChunk(empty)).toEqual([]);
}

export function assertLooseStringErrorMapsToProviderError(
	provider: OpenAICompatibleProvider,
): void {
	const looseError = jsonPayload({ error: "upstream failed" });
	if (isStrictCompatiblePreset(provider)) {
		expect(openaiCompatibleAdapter({ provider }).parseChunk(looseError)).toEqual([]);
		return;
	}
	expect(openaiCompatibleAdapter({ provider }).parseChunk(looseError)).toContainEqual(
		expect.objectContaining({ kind: "provider-error" }),
	);
}

export function assertSparseMetadataTextDelta(provider: OpenAICompatibleProvider): void {
	const sparse = jsonPayload({ choices: [{ delta: { content: "sparse ok" } }] });
	expect(openaiCompatibleAdapter({ provider }).parseChunk(sparse)).toEqual([
		{ kind: "text-delta", text: "sparse ok", choiceIndex: 0 },
	]);
}

export function assertReasoningContentAlias(provider: OpenAICompatibleProvider): void {
	const reasoningPayload = jsonPayload({
		choices: [{ delta: { reasoning_content: "trace step" } }],
	});
	const expected = [{ kind: "reasoning-delta", text: "trace step", variant: "detail" }];
	expect(openaiCompatibleAdapter({ provider }).parseChunk(reasoningPayload)).toEqual(expected);
}

export function assertUnrecognizablePayloadSilent(provider: OpenAICompatibleProvider): void {
	const unrecognizable = jsonPayload({ foo: "bar" });
	if (isStrictCompatiblePreset(provider)) {
		expect(() => openaiCompatibleAdapter({ provider }).parseChunk(unrecognizable)).toThrow(
			/openaiCompatibleAdapter\.parseChunk/,
		);
		return;
	}
	expect(openaiCompatibleAdapter({ provider }).parseChunk(unrecognizable)).toEqual([]);
}
