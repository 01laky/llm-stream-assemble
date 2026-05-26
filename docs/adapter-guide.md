# Adapter author guide

**Status:** Active guide — OpenAI Chat, OpenAI-compatible (including host presets through `1.3.5`), Anthropic Messages, OpenAI Responses, and **Google Gemini** are reference adapters.

How to add or extend a provider adapter for `llm-stream-assemble`.

## Prerequisites

- Read [`proposal.md`](./proposal.md) § Provider Adapters and § Unified Event Model.
- Adapters emit **raw chunks** only — cross-chunk assembly lives in core.
- Keep adapters dependency-free; provider SDKs do not belong in adapter implementations.
- Use `src/adapters/openai-chat.ts` and `test/fixtures/openai-chat/` as the reference implementation for mapping provider payloads into `RawChunk[]`.
- Use `openaiCompatibleAdapter()` as the reference pattern for reusing an existing parser with small dialect options instead of forking adapter logic.
- Adapter authors should prefer local provider-specific parsing logic, but internal shared helpers exist for safe unknown narrowing, optional RawChunk construction, JSON parsing, and prefixed adapter errors.

## Steps

### 1. Capture fixtures

- Record redacted `.sse` or `.json` files under `test/fixtures/<adapter-name>/`.
- Never commit API keys or private data.
- Include edge cases: empty deltas, unicode, parallel tools, large tool args.
- Add a fixture provenance note when fixtures are synthetic, docs-shaped, or redacted-live.
- Add golden tests for every provider feature and edge case.

### 2. Implement `parseChunk`

- Input: one SSE `data:` payload string (or JSONL line).
- Output: `RawChunk[]` — zero or more chunks.
- Do **not** accumulate text, tool args, or reasoning across calls.
- Minimal provider state is allowed only when required to preserve ids/indexes before core assembly, such as OpenAI tool-call `choiceIndex:index` tracking.

### 3. Implement `parseResponse` (optional)

- Input: non-streaming provider JSON body.
- Output: same `RawChunk[]` shape as streaming chunks.
- Enables `assembleResponse()` parity with `assembleStream()`.

### 4. Golden test

- Input: fixture file.
- Run: adapter + assembler (Phase 1+).
- Output: expected `StreamEvent[]` snapshot.
- Failures must show a clear diff when provider formats change.

### 5. Edge cases checklist

- [ ] Empty / whitespace deltas
- [ ] Unicode and emoji in text
- [ ] Multiple parallel tool calls
- [ ] Tool `index` before `id` (OpenAI)
- [ ] Incomplete stream (no terminal marker)
- [ ] Provider error payloads
- [ ] Invalid partial JSON (Anthropic fine-grained streaming)
- [ ] Unknown finish reasons
- [ ] Usage-only chunks
- [ ] Non-streaming response parity
- [ ] Anthropic content block lifecycle: start, delta, stop
- [ ] Anthropic fine-grained `input_json_delta` tool streaming
- [ ] Anthropic thinking / redacted thinking blocks

### 6. Update compatibility matrix

Add or update the row in [`compatibility.md`](./compatibility.md) with accurate feature flags.

### 7. Pull request

- Fixture + golden test required for any adapter change.
- Run `pnpm verify` before opening PR.
- Follow [CONTRIBUTING.md](../CONTRIBUTING.md).

## Replay and proxy helpers

- Use `assembleFromFile()` for local fixture replay while developing adapters.
- Use `toSSE(events, { sanitizeErrors: true })` when forwarding unified events
  from a proxy so raw provider internals are not exposed to browsers.
- Use `tapEvents()` for adapter debugging, logging, and metrics without changing
  the event stream.
- Use `openaiResponsesAdapter()` as the reference pattern for event-name-driven
  parsing where provider payloads are not Chat-style choice deltas.
- Use `geminiAdapter()` as the reference pattern for `candidates[].content.parts[]`
  parsing (text, `functionCall`, `thought` parts) on Google AI GenerateContent SSE.

## Factory naming convention

| Provider                  | Export                                                                                                                                                                                                                                                                                                                                       |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OpenAI Chat               | `openaiChatAdapter()`                                                                                                                                                                                                                                                                                                                        |
| OpenAI-compatible hosts   | `openaiCompatibleAdapter({ provider })` — presets include `deepseek`, `mistral`, `groq`, `ollama`, `lmstudio`, `together`, `fireworks`, `openrouter`, `perplexity`, `xai`, `azure`, `cloudflare` with host golden fixtures since `1.3.0`; preset SSOT and manifest-driven tests since `1.3.1`; maintainer fixture docs aligned since `1.3.2` |
| Anthropic Messages        | `anthropicAdapter()`                                                                                                                                                                                                                                                                                                                         |
| OpenAI Responses          | `openaiResponsesAdapter()`                                                                                                                                                                                                                                                                                                                   |
| Google Gemini (Google AI) | `geminiAdapter()`                                                                                                                                                                                                                                                                                                                            |

## Azure preset vs generic

Use `openaiCompatibleAdapter({ provider: "azure" })` **only** for Azure OpenAI Chat Completions endpoints (`*.openai.azure.com` with deployment path and `api-key` auth). Do **not** point the `azure` preset at non-Azure hosts — use `generic` or the host-specific preset (`groq`, `mistral`, …) instead. The azure preset enables stricter defaults (`allowMissingMetadata: false`, `looseErrorShape: false`) that will throw on wholly unrecognizable payloads where generic would silently return `[]`.

## Cloudflare preset vs generic

Use `openaiCompatibleAdapter({ provider: "cloudflare" })` for **Cloudflare Workers AI REST** at `https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1/chat/completions`. Do **not** use this preset for Azure, OpenAI, or arbitrary OpenAI-shaped hosts — use `generic` or the matching host preset instead. The `cloudflare` preset uses **DEFAULT_PRESET** (loose like Groq): it tolerates sparse metadata and returns `[]` for wholly unrecognizable payloads. It is **not** registered in `PRESET_OVERRIDES` with strict azure-style defaults. Worker `env.AI.run()` binding streams are documented in examples but tested via REST fixtures in CI.

## Maintainer: host golden fixtures

When adding or changing OpenAI-compatible host fixtures:

1. Place `.sse` / `.json` inputs and `.expected.json` under `test/fixtures/openai-compatible/<host>/`.
2. Regenerate expected files with `pnpm fixtures:generate-compatible` (see fixture README).
3. Optional: add `manifest.json` to drive golden/conformance test ids and `adapterOptions` (see `cloudflare/manifest.json`).
4. Generic loose-preset behavior belongs in **LSA-OC211**–**LSA-OC216** (`openai-compatible-loose-matrix.test.ts`); host-specific quirks get dedicated tests.
5. Preset keys must match `OPENAI_COMPATIBLE_PROVIDERS` in `openai-compatible-presets.ts`.

Use `resolveCompatibleAdapterConfig({ provider })` when you need resolved preset flags without constructing an adapter (since **1.3.5**).

## Assembler vs adapter state

- **Adapters** map one SSE/JSON payload → `RawChunk[]`. They must not accumulate text, tool args, or reasoning across payloads. Minimal per-stream state is allowed only for id/index reconciliation (e.g. OpenAI tool `index` before `id`).
- **`EventAssembler`** (core) is **stateful per stream**: it buffers text, reasoning, JSON, refusals, and open tool calls until `.done` / `finish` events. Public APIs create a **new assembler per** `assembleStream`, `assembleFromPayloads`, `assembleResponse`, or `createAssemblyTransform` call — do not share one instance across concurrent streams.
- **`EventAssembler.reset()`** clears all assembly state and is intended for **tests** or explicit reuse after a stream completes — not for multiplexing concurrent requests on one instance.
- **Transforms** (`tapEvents`, `toSSE`, `collectStream`) are stateless over the unified event stream.

See README Architecture lifecycle diagram (`docs/img/assembler-lifecycle.svg`) and [FAQ](./faq.md).

See [`test/fixtures/openai-compatible/README.md`](../test/fixtures/openai-compatible/README.md) and [`docs/live-smoke.md`](./live-smoke.md) checklist.

## Community adapters

Third-party adapters (Bedrock, etc.) can follow this guide in separate packages or PRs — core types (`StreamAdapter`, `RawChunk`, `StreamEvent`) are exported from `llm-stream-assemble/core`.
