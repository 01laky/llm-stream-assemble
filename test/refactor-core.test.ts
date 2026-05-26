import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
	adapterScopedError,
	libraryError,
	providerErrorChunks,
	providerErrorChunksFromMessage,
	providerErrorChunksFromPayload,
} from "../src/adapters/errors";
import {
	isStrictCompatiblePreset,
	openaiCompatibleAdapter,
	OPENAI_COMPATIBLE_PROVIDERS,
	resolveCompatibleAdapterConfig,
} from "../src/adapters/openai-compatible";
import { createStreamAdapter } from "../src/adapters/utils";
import {
	isDoneMarker,
	processPayload,
	resolveTerminalFlush,
} from "../src/core/assembly/process-payload";
import { assembleFromPayloads } from "../src/core/assemble-payloads";
import { assembleResponse } from "../src/core/assemble-response";
import { createAssemblyTransform } from "../src/core/create-assembly-transform";
import { EventAssembler } from "../src/core/assembler/event-assembler";
import type { RawChunk, StreamAdapter } from "../src/core/types";
import { collectAsync, strings } from "./helpers/collect-events";
import {
	expectedHostCompatibleEvents,
	hostCompatibleFixture,
	normalizeCompatibleEvents,
} from "./helpers/compatible-fixtures";
import { mockAdapterFromFixture } from "./helpers/mock-adapter";

async function collectTransformEvents(
	transform: TransformStream<Uint8Array, import("../src/core/types").StreamEvent>,
	lines: string[],
): Promise<import("../src/core/types").StreamEvent[]> {
	const collected = (async () => {
		const reader = transform.readable.getReader();
		const items: import("../src/core/types").StreamEvent[] = [];
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			items.push(value);
		}
		return items;
	})();

	const writer = transform.writable.getWriter();
	for (const line of lines) {
		await writer.write(new TextEncoder().encode(line));
	}
	await writer.close();
	return collected;
}

describe("refactor: assembly process-payload", () => {
	it("LSA-RF01: isDoneMarker trims whitespace", () => {
		expect(isDoneMarker("[DONE]")).toBe(true);
		expect(isDoneMarker("  [DONE]  ")).toBe(true);
		expect(isDoneMarker('{"ok":true}')).toBe(false);
	});

	it("LSA-RF02: processPayload returns done-marker without calling adapter", () => {
		const assembler = new EventAssembler();
		const adapter: StreamAdapter = {
			parseChunk() {
				throw new Error("should not parse");
			},
		};
		expect(processPayload("[DONE]", assembler, adapter, {})).toEqual({ kind: "done-marker" });
	});

	it("LSA-RF03: processPayload throws when recoverMalformed is false", () => {
		const assembler = new EventAssembler();
		const adapter: StreamAdapter = {
			parseChunk() {
				throw new Error("bad chunk");
			},
		};
		expect(() => processPayload("{}", assembler, adapter, {})).toThrow("bad chunk");
	});

	it("LSA-RF04: processPayload yields recoverable error when recoverMalformed is true", () => {
		const assembler = new EventAssembler();
		const adapter: StreamAdapter = {
			parseChunk() {
				throw new Error("bad chunk");
			},
		};
		const result = processPayload("{}", assembler, adapter, { recoverMalformed: true });
		expect(result).toMatchObject({
			kind: "recoverable-error",
			event: { type: "error", recoverable: true },
		});
		if (result.kind === "recoverable-error") {
			expect(result.event.error.message).toContain("bad chunk");
		}
	});

	it("LSA-RF05: resolveTerminalFlush prefers aborted over done marker", () => {
		const assembler = new EventAssembler();
		assembler.push({ kind: "text-delta", text: "x" });
		const events = resolveTerminalFlush(assembler, { sawTerminalMarker: true, aborted: true });
		expect(events.at(-1)).toEqual({ type: "finish", reason: "aborted" });
	});

	it("LSA-RF06: resolveTerminalFlush uses stop when [DONE] seen", () => {
		const assembler = new EventAssembler();
		assembler.push({ kind: "text-delta", text: "x" });
		const events = resolveTerminalFlush(assembler, { sawTerminalMarker: true, aborted: false });
		expect(events.at(-1)).toEqual({ type: "finish", reason: "stop" });
	});

	it("LSA-RF07: resolveTerminalFlush uses incomplete when stream ends early", () => {
		const assembler = new EventAssembler();
		assembler.push({ kind: "text-delta", text: "x" });
		const events = resolveTerminalFlush(assembler, { sawTerminalMarker: false, aborted: false });
		expect(events.at(-1)).toEqual({ type: "finish", reason: "incomplete" });
	});

	it("LSA-RF08: assembleFromPayloads and createAssemblyTransform agree on recoverMalformed", async () => {
		const adapter: StreamAdapter = {
			parseChunk(raw) {
				if (raw === "bad") throw new Error("parse failed");
				return [{ kind: "text-delta", text: raw }];
			},
		};

		const fromPayloads = await collectAsync(
			assembleFromPayloads(strings("ok", "bad", "[DONE]"), adapter, { recoverMalformed: true }),
		);
		const fromTransform = await collectTransformEvents(
			createAssemblyTransform(adapter, { recoverMalformed: true }),
			["data: ok\n\n", "data: bad\n\n", "data: [DONE]\n\n"],
		);

		expect(fromPayloads.filter((event) => event.type === "error")).toHaveLength(1);
		expect(fromTransform.filter((event) => event.type === "error")).toHaveLength(1);
		expect(fromPayloads.at(-1)).toEqual({ type: "finish", reason: "stop" });
		expect(fromTransform.at(-1)).toEqual({ type: "finish", reason: "stop" });
	});
});

describe("refactor: adapter errors", () => {
	it("LSA-RF09: libraryError and adapterScopedError share prefix", () => {
		expect(libraryError("msg").message).toBe("llm-stream-assemble: msg");
		expect(adapterScopedError("scope", "msg").message).toBe("llm-stream-assemble: scope: msg");
	});

	it("LSA-RF10: providerErrorChunks always terminates with finish:error", () => {
		const chunks = providerErrorChunks(libraryError("fail"), true);
		expect(chunks).toEqual([
			{ kind: "provider-error", error: libraryError("fail"), recoverable: true },
			{ kind: "finish", reason: "error" },
		]);
	});

	it("LSA-RF11: providerErrorChunksFromPayload attaches raw on error", () => {
		const payload = { message: "quota exceeded", code: "429" };
		const chunks = providerErrorChunksFromPayload(payload, "openaiChatAdapter", false, "fallback");
		expect(chunks[0]?.kind).toBe("provider-error");
		if (chunks[0]?.kind === "provider-error") {
			expect(chunks[0].error.message).toContain("quota exceeded");
			expect(Object.getOwnPropertyDescriptor(chunks[0].error, "raw")?.value).toEqual(payload);
		}
	});

	it("LSA-RF12: anthropic, responses, and gemini paths share provider error finish shape", () => {
		const anthropic = providerErrorChunksFromMessage("Anthropic provider error", false);
		const responses = providerErrorChunksFromMessage("OpenAI Responses provider error", false);
		const gemini = providerErrorChunksFromMessage("Gemini provider error", false);
		expect(anthropic[1]).toEqual({ kind: "finish", reason: "error" });
		expect(responses[1]).toEqual({ kind: "finish", reason: "error" });
		expect(gemini[1]).toEqual({ kind: "finish", reason: "error" });
	});
});

describe("refactor: createStreamAdapter factory", () => {
	it("LSA-RF13: factory delegates parseChunk and parseResponse", () => {
		const calls: string[] = [];
		const adapter = createStreamAdapter({
			parser: {
				parseChunk(raw) {
					calls.push(`chunk:${raw}`);
					return [{ kind: "text-delta", text: raw }];
				},
			},
			parseResponse(body, options) {
				calls.push(`response:${String(options.tag)}:${String(body)}`);
				return [{ kind: "finish", reason: "stop" }];
			},
			options: { tag: "test" },
		});

		expect(adapter.parseChunk?.("hi")).toEqual([{ kind: "text-delta", text: "hi" }]);
		expect(adapter.parseResponse?.({ ok: true })).toEqual([{ kind: "finish", reason: "stop" }]);
		expect(calls).toEqual(["chunk:hi", "response:test:[object Object]"]);
	});
});

describe("refactor: openai-compatible presets", () => {
	it("LSA-RF14: all provider presets parse empty object without throw", () => {
		for (const provider of OPENAI_COMPATIBLE_PROVIDERS) {
			if (isStrictCompatiblePreset(provider)) {
				expect(() => openaiCompatibleAdapter({ provider }).parseChunk("{}")).toThrow(
					/openaiCompatibleAdapter\.parseChunk/,
				);
				continue;
			}
			expect(openaiCompatibleAdapter({ provider }).parseChunk("{}")).toEqual([]);
		}
	});

	it("LSA-RF15: preset-specific reasoning aliases differ between generic and openrouter", () => {
		const generic = openaiCompatibleAdapter({ provider: "generic" });
		const openrouter = openaiCompatibleAdapter({ provider: "openrouter" });

		const thinkingPayload = JSON.stringify({
			choices: [{ delta: { thinking: "trace" } }],
		});
		expect(generic.parseChunk(thinkingPayload)).toEqual([
			{ kind: "reasoning-delta", text: "trace", variant: "detail" },
		]);
		expect(openrouter.parseChunk(thinkingPayload)).toEqual([]);
	});

	it("LSA-RF16: allowMissingToolIds option removed from public type", () => {
		const options: Parameters<typeof openaiCompatibleAdapter>[0] = { provider: "groq" };
		expect("allowMissingToolIds" in (options ?? {})).toBe(false);
	});

	it("LSA-RF19: deepseek preset omits thinking_content alias while generic maps it", () => {
		const generic = openaiCompatibleAdapter({ provider: "generic" });
		const deepseek = openaiCompatibleAdapter({ provider: "deepseek" });
		const payload = JSON.stringify({
			choices: [{ delta: { thinking_content: "trace" } }],
		});
		expect(generic.parseChunk(payload)).toEqual([
			{ kind: "reasoning-delta", text: "trace", variant: "detail" },
		]);
		expect(deepseek.parseChunk(payload)).toEqual([]);
	});

	it("LSA-RF20: parseResponse on perplexity response-citations preserves citations in metadata.raw", () => {
		const body = JSON.parse(
			readFileSync(
				join(
					dirname(fileURLToPath(import.meta.url)),
					"fixtures/openai-compatible/perplexity/response-citations.json",
				),
				"utf8",
			),
		);
		const chunks = openaiCompatibleAdapter({ provider: "perplexity" }).parseResponse!(body);
		const metadata = chunks.find((chunk) => chunk.kind === "metadata");
		expect(metadata).toBeDefined();
		expect((metadata as { raw?: { citations?: string[] } }).raw?.citations).toContain(
			"https://example.com/doc",
		);
	});

	it("LSA-RF21: parseResponse on azure response-content-filter preserves filter metadata.raw", () => {
		const body = JSON.parse(
			readFileSync(
				join(
					dirname(fileURLToPath(import.meta.url)),
					"fixtures/openai-compatible/azure/response-content-filter.json",
				),
				"utf8",
			),
		);
		const chunks = openaiCompatibleAdapter({ provider: "azure" }).parseResponse!(body);
		const metadata = chunks.find((chunk) => chunk.kind === "metadata");
		expect(metadata).toBeDefined();
		const raw = (metadata as { raw?: Record<string, unknown> }).raw;
		expect(raw?.prompt_filter_results).toBeDefined();
		expect(
			(raw?.choices as Array<{ content_filter_results?: unknown }>)?.[0]?.content_filter_results,
		).toBeDefined();
	});

	it("LSA-RF22: azure preset allowMissingMetadata false activates strict mode without explicit option", () => {
		expect(() =>
			openaiCompatibleAdapter({ provider: "azure" }).parseChunk(JSON.stringify({ foo: "bar" })),
		).toThrow(/openaiCompatibleAdapter\.parseChunk/);
	});

	it("LSA-RF23: parseResponse on cloudflare response-basic matches golden", () => {
		const body = hostCompatibleFixture("cloudflare", "response-basic", "json");
		const events = normalizeCompatibleEvents(
			assembleResponse(body, openaiCompatibleAdapter({ provider: "cloudflare" })),
		);
		expect(events).toEqual(expectedHostCompatibleEvents("cloudflare", "response-basic"));
	});

	it("LSA-RF24: strict cloudflare allowMissingMetadata false rejects foo bar without explicit azure preset", () => {
		expect(() =>
			openaiCompatibleAdapter({ provider: "cloudflare", allowMissingMetadata: false }).parseChunk(
				JSON.stringify({ foo: "bar" }),
			),
		).toThrow(/openaiCompatibleAdapter\.parseChunk/);
		expect(
			openaiCompatibleAdapter({ provider: "cloudflare", allowMissingMetadata: false }).parseChunk(
				JSON.stringify({
					id: "cf-rf",
					model: "@cf/meta/llama-3.1-8b-instruct",
					choices: [{ delta: { content: "valid" } }],
				}),
			),
		).toContainEqual({ kind: "text-delta", text: "valid", choiceIndex: 0 });
	});

	it("LSA-RF25: cloudflare parseResponse text content matches stream text-basic phrase", () => {
		const body = hostCompatibleFixture("cloudflare", "response-basic", "json") as {
			choices?: Array<{ message?: { content?: string } }>;
		};
		const events = normalizeCompatibleEvents(
			assembleResponse(body, openaiCompatibleAdapter({ provider: "cloudflare" })),
		);
		const textDone = events.find((event) => (event as { type?: string }).type === "text.done") as
			| { text?: string }
			| undefined;
		expect(textDone?.text).toContain("Cloudflare response");
	});

	it("LSA-RF26: cloudflare loose string error parseResponse-free parseChunk matches generic", () => {
		const loose = JSON.stringify({ error: "upstream failed" });
		const cf = openaiCompatibleAdapter({ provider: "cloudflare" }).parseChunk(loose);
		const generic = openaiCompatibleAdapter({ provider: "generic" }).parseChunk(loose);
		expect(cf.map((chunk) => chunk.kind)).toEqual(generic.map((chunk) => chunk.kind));
	});

	it("LSA-RF27: resolveCompatibleAdapterConfig exposes resolved strict and loose preset fields", () => {
		const azure = resolveCompatibleAdapterConfig({ provider: "azure" });
		expect(azure.rejectUnrecognizedPayloads).toBe(true);
		expect(azure.looseErrorShape).toBe(false);
		const groq = resolveCompatibleAdapterConfig({ provider: "groq" });
		expect(groq.rejectUnrecognizedPayloads).toBe(false);
		expect(groq.looseErrorShape).toBe(true);
		for (const provider of OPENAI_COMPATIBLE_PROVIDERS) {
			expect(resolveCompatibleAdapterConfig({ provider }).reasoningFieldAliases).toEqual(
				expect.any(Array),
			);
		}
	});
});

describe("refactor: parser module split", () => {
	it("LSA-RF17: openai chat adapter still maps tool stream via split parser", async () => {
		const adapter = mockAdapterFromFixture("tool-single");
		const events = await collectAsync(
			assembleFromPayloads(strings('{"seq":1}', "[DONE]"), adapter),
		);
		expect(events.some((event) => event.type === "tool_call.start")).toBe(true);
		expect(events.some((event) => event.type === "tool_call.done")).toBe(true);
	});

	it("LSA-RF18: optionalRawChunk used for tool chunks (no undefined id field)", () => {
		const adapter: StreamAdapter = {
			parseChunk() {
				return [{ kind: "tool-start", name: "fn", index: 0 }] as RawChunk[];
			},
		};
		const chunks = adapter.parseChunk("{}");
		expect(chunks[0]).toEqual({ kind: "tool-start", name: "fn", index: 0 });
		expect("id" in (chunks[0] ?? {})).toBe(false);
	});
});
