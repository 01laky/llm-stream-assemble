import { expect } from "vitest";
import { openaiChatAdapter } from "../../src/adapters/openai-chat";
import {
	openaiCompatibleAdapter,
	resolveCompatibleAdapterConfig,
} from "../../src/adapters/openai-compatible";
import {
	isStrictCompatiblePreset,
	LOOSE_HOST_PRESETS,
	type OpenAICompatibleProvider,
	STRICT_COMPATIBLE_PRESETS,
} from "../../src/adapters/openai-compatible-presets";
import { assembleStream } from "../../src/core/assemble-stream";
import { byteStreamFromStrings, collectAsync } from "./collect-events";
import {
	hostCompatibleFixture,
	hostFixtureAdapterOptions,
	normalizeCompatibleEvents,
} from "./compatible-fixtures";

export { LOOSE_HOST_PRESETS, STRICT_COMPATIBLE_PRESETS };

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

export function assertValidMinimalChunk(provider: OpenAICompatibleProvider): void {
	const valid = jsonPayload({
		id: "min",
		model: "test-model",
		choices: [{ delta: { content: "ok" } }],
	});
	expect(openaiCompatibleAdapter({ provider }).parseChunk(valid)).toContainEqual({
		kind: "text-delta",
		text: "ok",
		choiceIndex: 0,
	});
}

export function assertObjectErrorShape(provider: OpenAICompatibleProvider): void {
	const objectError = jsonPayload({
		error: { message: "bad", type: "invalid_request_error", code: "x" },
	});
	expect(openaiCompatibleAdapter({ provider }).parseChunk(objectError)).toContainEqual(
		expect.objectContaining({ kind: "provider-error" }),
	);
}

export function assertUnknownDeltaKeysIgnored(provider: OpenAICompatibleProvider): void {
	expect(
		openaiCompatibleAdapter({ provider }).parseChunk(
			jsonPayload({ choices: [{ delta: { content: "hi", unknown_field: "x" } }] }),
		),
	).toContainEqual({ kind: "text-delta", text: "hi", choiceIndex: 0 });
}

export type ReasoningExpectation = "detail" | "summary" | "none";

export const PRESET_REASONING_FIELD_CASES: Array<{
	field: string;
	expectations: Partial<Record<OpenAICompatibleProvider, ReasoningExpectation>>;
}> = [
	{
		field: "thinking_content",
		expectations: {
			generic: "detail",
			deepseek: "none",
			openrouter: "none",
			azure: "none",
		},
	},
	{
		field: "thinking",
		expectations: {
			generic: "detail",
			openrouter: "none",
			deepseek: "detail",
		},
	},
	{
		field: "reasoning_delta",
		expectations: {
			generic: "none",
			together: "detail",
		},
	},
	{
		field: "reasoning",
		expectations: {
			generic: "detail",
			openrouter: "detail",
			deepseek: "detail",
			together: "detail",
		},
	},
	{
		field: "reasoning_content",
		expectations: {
			generic: "detail",
			deepseek: "detail",
			openrouter: "detail",
			together: "detail",
			azure: "detail",
			cloudflare: "detail",
		},
	},
	{
		field: "reasoning_summary",
		expectations: {
			generic: "summary",
			azure: "summary",
		},
	},
];

export function assertPresetReasoningField(
	provider: OpenAICompatibleProvider,
	field: string,
	expectation: ReasoningExpectation,
): void {
	const payload = jsonPayload({ choices: [{ delta: { [field]: "trace" } }] });
	const chunks = openaiCompatibleAdapter({ provider }).parseChunk(payload);
	if (expectation === "none") {
		expect(chunks.filter((chunk) => chunk.kind === "reasoning-delta")).toEqual([]);
		return;
	}
	expect(chunks).toEqual([
		{
			kind: "reasoning-delta",
			text: "trace",
			variant: expectation,
		},
	]);
}

export async function assertOpenAIChatStreamParity(
	host: OpenAICompatibleProvider,
	fixtureName: string,
): Promise<void> {
	const sse = hostCompatibleFixture(host, fixtureName, "sse") as string;
	const adapterOptions = hostFixtureAdapterOptions(host, fixtureName);
	const compatibleEvents = normalizeCompatibleEvents(
		await collectAsync(
			assembleStream(
				byteStreamFromStrings(sse),
				openaiCompatibleAdapter({ provider: host, ...adapterOptions }),
			),
		),
	);
	const chatEvents = normalizeCompatibleEvents(
		await collectAsync(
			assembleStream(
				byteStreamFromStrings(sse),
				openaiChatAdapter(adapterOptions.jsonMode ? { jsonMode: true } : {}),
			),
		),
	);
	expect(compatibleEvents).toEqual(chatEvents);
}

export function assertResolvedStrictPreset(provider: "azure"): void {
	const resolved = resolveCompatibleAdapterConfig({ provider });
	expect(resolved.allowMissingMetadata).toBe(false);
	expect(resolved.looseErrorShape).toBe(false);
	expect(resolved.rejectUnrecognizedPayloads).toBe(true);
	expect(resolved.reasoningFieldAliases).toEqual([]);
}

export function assertResolvedLooseDefault(provider: OpenAICompatibleProvider): void {
	if (isStrictCompatiblePreset(provider)) return;
	const resolved = resolveCompatibleAdapterConfig({ provider });
	expect(resolved.allowMissingMetadata).toBe(true);
	expect(resolved.looseErrorShape).toBe(true);
	expect(resolved.rejectUnrecognizedPayloads).toBe(false);
}
