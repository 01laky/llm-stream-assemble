import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
	openaiCompatibleAdapter,
	resolveCompatibleAdapterConfig,
} from "../src/adapters/openai-compatible";
import { OPENAI_COMPATIBLE_PROVIDERS } from "../src/adapters/openai-compatible-presets";
import { assembleStream } from "../src/core/assemble-stream";
import { runAdapterGoldenStream } from "./helpers/adapter-conformance";
import { byteStreamFromStrings, collectAsync } from "./helpers/collect-events";
import {
	expectedHostCompatibleEvents,
	hostCompatibleFixture,
	HOST_COMPATIBLE_PRESETS,
	hostFixtureAdapterOptions,
	listHostStreamFixtures,
	normalizeCompatibleEvents,
	normalizeCompatibleRawChunks,
} from "./helpers/compatible-fixtures";
import {
	assertOpenAIChatStreamParity,
	assertResolvedLooseDefault,
	assertResolvedStrictPreset,
	assertUnknownDeltaKeysIgnored,
	jsonPayload,
	LOOSE_HOST_PRESETS,
} from "./helpers/compatible-preset-matrix";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures/openai-compatible");
const payload = jsonPayload;

describe("openaiCompatibleAdapter exhaustive edge coverage", () => {
	it("LSA-OC220: reasoning_summary maps to summary variant on generic preset", () => {
		expect(
			openaiCompatibleAdapter().parseChunk(
				payload({ choices: [{ delta: { reasoning_summary: "brief" } }] }),
			),
		).toEqual([{ kind: "reasoning-delta", text: "brief", variant: "summary" }]);
	});

	it("LSA-OC221: completion_tokens_details.reasoning_tokens maps on compatible adapter", () => {
		expect(
			normalizeCompatibleRawChunks(
				openaiCompatibleAdapter().parseChunk(
					payload({
						choices: [],
						usage: { completion_tokens_details: { reasoning_tokens: 7 } },
					}),
				),
			),
		).toEqual([{ kind: "usage", reasoningTokens: 7 }]);
	});

	it("LSA-OC222: unknown finish_reason emits provider-error and finish error", () => {
		expect(
			normalizeCompatibleRawChunks(
				openaiCompatibleAdapter().parseChunk(
					payload({ choices: [{ index: 0, finish_reason: "mystery" }] }),
				),
			),
		).toEqual([
			{ kind: "provider-error", recoverable: true },
			{ kind: "finish", reason: "error", choiceIndex: 0 },
		]);
	});

	it("LSA-OC223: finish_reason function_call maps to tool_calls", () => {
		expect(
			openaiCompatibleAdapter().parseChunk(
				payload({ choices: [{ index: 0, finish_reason: "function_call" }] }),
			),
		).toEqual([{ kind: "finish", reason: "tool_calls", choiceIndex: 0 }]);
	});

	it("LSA-OC224: multichoice stream preserves choiceIndex on text deltas", () => {
		expect(
			openaiCompatibleAdapter().parseChunk(
				payload({
					choices: [
						{ index: 0, delta: { content: "a" } },
						{ index: 1, delta: { content: "b" } },
					],
				}),
			),
		).toEqual([
			{ kind: "text-delta", text: "a", choiceIndex: 0 },
			{ kind: "text-delta", text: "b", choiceIndex: 1 },
		]);
	});

	it("LSA-OC225: delta.refusal maps to refusal-delta on compatible adapter", () => {
		expect(
			openaiCompatibleAdapter().parseChunk(
				payload({ choices: [{ delta: { refusal: "no thanks" } }] }),
			),
		).toEqual([{ kind: "refusal-delta", text: "no thanks" }]);
	});

	it("LSA-OC226: legacy function_call delta maps to tool-start", () => {
		expect(
			openaiCompatibleAdapter().parseChunk(
				payload({
					choices: [
						{
							delta: {
								function_call: { name: "lookup", arguments: '{"q":' },
							},
						},
					],
				}),
			),
		).toContainEqual(
			expect.objectContaining({
				kind: "tool-start",
				name: "lookup",
			}),
		);
	});

	it("LSA-OC227: azure preset keeps useChoicePositionFallback true by default", () => {
		expect(
			openaiCompatibleAdapter({ provider: "azure" }).parseChunk(
				payload({ choices: [{ delta: { content: "no index" } }] }),
			),
		).toContainEqual({ kind: "text-delta", text: "no index", choiceIndex: 0 });
	});

	it("LSA-OC227b: azure with useChoicePositionFallback false omits choiceIndex when missing", () => {
		expect(
			openaiCompatibleAdapter({
				provider: "azure",
				useChoicePositionFallback: false,
			}).parseChunk(payload({ choices: [{ delta: { content: "no index" } }] })),
		).toContainEqual({ kind: "text-delta", text: "no index" });
	});

	it("LSA-OC256: generic jsonMode maps json-mode fixture root stream to json deltas", async () => {
		const sse = readFileSync(join(fixturesDir, "json-mode.sse"), "utf8");
		const events = normalizeCompatibleEvents(
			await collectAsync(
				assembleStream(byteStreamFromStrings(sse), openaiCompatibleAdapter({ jsonMode: true })),
			),
		);
		expect(events.some((event) => (event as { type?: string }).type?.startsWith("json."))).toBe(
			true,
		);
	});

	it("LSA-OC257: groq/tool-single.sse matches expected golden events", async () => {
		const events = normalizeCompatibleEvents(
			await collectAsync(
				assembleStream(
					byteStreamFromStrings(hostCompatibleFixture("groq", "tool-single", "sse") as string),
					openaiCompatibleAdapter({ provider: "groq" }),
				),
			),
		);
		expect(events).toEqual(expectedHostCompatibleEvents("groq", "tool-single"));
	});

	it("LSA-OC258: every loose host ignores unknown delta keys", () => {
		for (const provider of LOOSE_HOST_PRESETS) {
			assertUnknownDeltaKeysIgnored(provider);
		}
	});

	it("LSA-OC259: resolveCompatibleAdapterConfig returns strict azure defaults", () => {
		assertResolvedStrictPreset("azure");
	});

	it("LSA-OC260: resolveCompatibleAdapterConfig returns loose defaults for groq", () => {
		assertResolvedLooseDefault("groq");
	});

	it("LSA-OC261: explicit options override preset allowMissingMetadata", () => {
		const resolved = resolveCompatibleAdapterConfig({
			provider: "groq",
			allowMissingMetadata: false,
		});
		expect(resolved.rejectUnrecognizedPayloads).toBe(true);
	});

	it("LSA-OC262: metadata-only payload with id emits message-start", () => {
		expect(
			openaiCompatibleAdapter().parseChunk(payload({ id: "meta-only", model: "m", choices: [] })),
		).toContainEqual({ kind: "message-start", id: "meta-only" });
	});

	it("LSA-OC263: usage-only chunk with prompt and completion token aliases", () => {
		expect(
			normalizeCompatibleRawChunks(
				openaiCompatibleAdapter().parseChunk(
					payload({ usage: { prompt_tokens: 2, completion_tokens: 3 } }),
				),
			),
		).toEqual([{ kind: "usage", inputTokens: 2, outputTokens: 3 }]);
	});

	it("LSA-OC264: all finish reasons stop length content_filter tool_calls map on compatible", () => {
		for (const [reason, mapped] of [
			["stop", "stop"],
			["length", "length"],
			["content_filter", "content_filter"],
			["tool_calls", "tool_calls"],
		] as const) {
			expect(
				openaiCompatibleAdapter().parseChunk(payload({ choices: [{ finish_reason: reason }] })),
			).toContainEqual({ kind: "finish", reason: mapped, choiceIndex: 0 });
		}
	});
});

describe("openaiCompatibleAdapter resolveCompatibleAdapterConfig SSOT", () => {
	it("LSA-OC265: every provider preset resolves without throw", () => {
		for (const provider of OPENAI_COMPATIBLE_PROVIDERS) {
			expect(() => resolveCompatibleAdapterConfig({ provider })).not.toThrow();
		}
	});
});

describe("openaiCompatibleAdapter full host stream conformance", () => {
	for (const host of HOST_COMPATIBLE_PRESETS) {
		for (const name of listHostStreamFixtures(host)) {
			it(`LSA-OC228: runAdapterGoldenStream parity for ${host}/${name}`, async () => {
				const adapterOptions = hostFixtureAdapterOptions(host, name);
				const events = normalizeCompatibleEvents(
					await runAdapterGoldenStream({
						adapter: openaiCompatibleAdapter({ provider: host, ...adapterOptions }),
						fixtureSsePath: join(fixturesDir, host, `${name}.sse`),
						expectedEventsPath: join(fixturesDir, host, `${name}.expected.json`),
						adapterFactory: () => openaiCompatibleAdapter({ provider: host, ...adapterOptions }),
					}),
				);
				expect(events).toEqual(expectedHostCompatibleEvents(host, name));
			});
		}
	}
});

describe("openaiCompatibleAdapter tool stream openaiChat parity", () => {
	const toolParityFixtures = [
		["groq", "tool-single"],
		["groq", "missing-tool-id"],
		["mistral", "tool-parallel"],
		["deepseek", "tool-single"],
		["fireworks", "tool-single"],
		["xai", "tool-single"],
		["ollama", "tool-missing-id"],
		["azure", "tool-single"],
		["cloudflare", "tool-single"],
	] as const;

	for (const [host, fixture] of toolParityFixtures) {
		it(`LSA-OC231: ${host}/${fixture} matches openaiChatAdapter stream events`, async () => {
			await assertOpenAIChatStreamParity(host, fixture);
		});
	}
});
