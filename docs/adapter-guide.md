# Adapter author guide

**Status:** Active guide — OpenAI Chat, OpenAI-compatible (including host presets through `1.7.0`), Anthropic Messages, OpenAI Responses, **Google Gemini (Google AI + Vertex AI)**, **AWS Bedrock**, and **Cohere Chat v2** are reference adapters.

Every dedicated built-in adapter has a shared conformance harness under `test/*-conformance.test.ts` (OpenAI Chat: **LSA-OC253**–**OC255**).

How to add or extend a provider adapter for `llm-stream-assemble`.

## Prerequisites

- Read [`proposal.md`](./proposal.md) § Provider Adapters and § Unified Event Model.
- Adapters emit **raw chunks** only — cross-chunk assembly lives in core.
- Keep adapters dependency-free; provider SDKs do not belong in adapter implementations.
- Use `src/adapters/openai-chat.ts` and `test/fixtures/openai-chat/` as the reference implementation for mapping provider payloads into `RawChunk[]`.
- Use `openaiCompatibleAdapter()` as the reference pattern for reusing an existing parser with small dialect options instead of forking adapter logic.
- Adapter authors should prefer local provider-specific parsing logic, but internal shared helpers under `src/adapters/shared/` cover parse preamble, usage token aliases, Anthropic-like stop reasons, incremental tool JSON deltas, text/json routing, and Anthropic block mapping — see [Shared internal modules](#shared-internal-modules) below.

## Shared internal modules

Since **1.4.1**, reference adapters share internal utilities (not public API):

| Module                       | Purpose                                                   |
| ---------------------------- | --------------------------------------------------------- |
| `shared/parse-payload.ts`    | Trim, skip `[DONE]`, parse JSON object, scoped errors     |
| `shared/incremental-json.ts` | Prefix-diff streaming tool argument strings               |
| `shared/stop-reasons.ts`     | `mapAnthropicLikeStopReason` for Anthropic + Bedrock      |
| `shared/usage.ts`            | `buildUsageChunk` with cross-provider token field aliases |
| `shared/text-delta.ts`       | `textOrJsonDelta` for jsonMode text routing               |
| `shared/anthropic-blocks.ts` | Shared Anthropic content block → `RawChunk[]` mapping     |
| `shared/logprobs.ts`         | OpenAI-shaped `choices[].logprobs` → `logprob` RawChunks  |

New adapters should reuse these helpers instead of copying parse guards or usage builders. Extend shared modules when two or more adapters need the same behavior.

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

## Gemini Vertex decode boundary

Vertex AI **`streamGenerateContent`** often returns **newline-delimited JSON** or a **JSON array streamed as concatenated objects** — not `data:` SSE lines. **`geminiAdapter.parseChunk(raw)` accepts one decoded JSON object string per chunk** after your app splits the HTTP body.

1. Read bytes from `response.body`.
2. Yield one complete JSON object string per line or brace-balanced object (see [`examples/vertex/read-chunk-stream.ts`](../examples/vertex/read-chunk-stream.ts): `readVertexJsonlStrings`, `readVertexChunkStrings`).
3. Call `assembleFromPayloads(lines(), geminiAdapter({ apiSurface: "vertex", jsonMode }))`.

**`apiSurface`:** `"google-ai"` (default) for `generativelanguage.googleapis.com` SSE payloads; `"vertex"` for Vertex hosts (`{region}-aiplatform.googleapis.com`).

**`normalizeVertexChunk(payload)`** (exported) strips common Vertex / gateway envelopes before mapping:

| Envelope shape                                                    | Normalized to                                     |
| ----------------------------------------------------------------- | ------------------------------------------------- |
| `{ response: { … } }`                                             | `response` object                                 |
| `{ result: { … } }`                                               | `result` object                                   |
| `{ predictions: [ { … } ] }`                                      | first prediction object                           |
| Already GenerateContent-shaped (`candidates`, `usageMetadata`, …) | payload as-is                                     |
| Unknown trace / status only                                       | `null` → `metadata.raw` forward compat in adapter |

Auth, project id, location, and URL construction stay outside the library — see [`examples/vertex/build-vertex-url.ts`](../examples/vertex/build-vertex-url.ts) and [`examples/node-fetch/vertex-gemini.ts`](../examples/node-fetch/vertex-gemini.ts).

Fixtures: `test/fixtures/gemini/vertex/`. Regenerate goldens: `pnpm fixtures:generate-gemini` (check: `pnpm fixtures:check-gemini`).

## Factory naming convention

| Provider                           | Export                                                                                                                                                                                                                                                                                                                                       |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OpenAI Chat                        | `openaiChatAdapter()`                                                                                                                                                                                                                                                                                                                        |
| OpenAI-compatible hosts            | `openaiCompatibleAdapter({ provider })` — presets include `deepseek`, `mistral`, `groq`, `ollama`, `lmstudio`, `together`, `fireworks`, `openrouter`, `perplexity`, `xai`, `azure`, `cloudflare` with host golden fixtures since `1.3.0`; preset SSOT and manifest-driven tests since `1.3.1`; maintainer fixture docs aligned since `1.3.2` |
| Anthropic Messages                 | `anthropicAdapter()`                                                                                                                                                                                                                                                                                                                         |
| OpenAI Responses                   | `openaiResponsesAdapter()`                                                                                                                                                                                                                                                                                                                   |
| Google Gemini (Google AI + Vertex) | `geminiAdapter({ apiSurface?: "google-ai" or "vertex", jsonMode? })`                                                                                                                                                                                                                                                                         |
| AWS Bedrock                        | `bedrockAdapter()`                                                                                                                                                                                                                                                                                                                           |
| Cohere Chat v2                     | `cohereAdapter()`                                                                                                                                                                                                                                                                                                                            |

## Bedrock decode boundary

Bedrock **ConverseStream** responses are often binary AWS EventStream. **`bedrockAdapter.parseChunk(raw)` accepts one decoded UTF-8 JSON string per ConverseStream event** — same contract as other adapters. Binary framing, IAM, and SigV4 signing stay outside the library.

See also the roadmap [Input format matrix](./post-1.0-provider-roadmap.md#input-format-matrix-decode-boundary).

| Transport                | Typical providers                                | Decode owner                 | Adapter input                   |
| ------------------------ | ------------------------------------------------ | ---------------------------- | ------------------------------- |
| SSE (`data:` lines)      | OpenAI, Anthropic, Gemini (Google AI), Cohere v2 | `parseSSE()` in core         | JSON string per `data:` payload |
| NDJSON / JSONL           | Vertex Gemini, proxies, batch                    | App or example helper        | One JSON object string per line |
| AWS EventStream (binary) | Bedrock                                          | App / AWS SDK / example util | Decoded JSON text per event     |
| Non-streaming JSON body  | All providers                                    | HTTP client                  | `parseResponse(body)`           |

**`modelFamily`** (`anthropic` | `openai-like` | `nova` | `auto`) hints which ConverseStream dialect to prefer when envelopes overlap. Default `"auto"` uses structural detection; set explicitly when you know the Bedrock model family.

Use `bedrockAdapter()` as the reference pattern for event-name ConverseStream envelopes (`messageStart`, `contentBlockDelta`, `messageStop`, …) on **pre-decoded** JSON strings. Example decode helper: [`examples/bedrock/decode-event-stream.ts`](../examples/bedrock/decode-event-stream.ts).

## Cohere v2 SSE events

Cohere Chat **v2** streams JSON objects over standard SSE (`data: {...}\n`). **`cohereAdapter.parseChunk(raw)` accepts one decoded JSON object string per event** — same contract as OpenAI Chat and Anthropic. Use `assembleStream(response.body, cohereAdapter())` so core `parseSSE()` handles line buffering.

**Not OpenAI-compatible:** do not reuse `openaiCompatibleAdapter()` for Cohere — v2 event names and nested `delta.message` shapes require a dedicated parser.

| Cohere v2 event   | Unified mapping                                                                                    |
| ----------------- | -------------------------------------------------------------------------------------------------- |
| `message-start`   | `message.start`, optional `metadata` (id, role)                                                    |
| `content-delta`   | `text.delta` / `text.done` (or `json.*` when `jsonMode`)                                           |
| `tool-plan-delta` | `reasoning.delta` / `reasoning.done` (`variant: "detail"`)                                         |
| `tool-call-start` | `tool_call.start`                                                                                  |
| `tool-call-delta` | `tool_call.args.delta` (incremental JSON via shared helper)                                        |
| `tool-call-end`   | `tool_call.done`                                                                                   |
| `citation-start`  | `citation` (span, sources, index; optional legacy `metadata.raw` via `emitLegacyCitationMetadata`) |
| `message-end`     | `usage`, `finish`, optional finish metadata                                                        |
| `type: "error"`   | `error` chunks via shared provider-error helpers                                                   |

**Late tool id:** Cohere may emit `tool-call-start` before a stable tool `id` is known. The adapter synthesizes `cohere:tool:{index}` on `tool_call.start` and reconciles to the real id when it arrives on `tool-call-delta`. Downstream consumers should key on the reconciled id from args/done events. At stream end the assembler may emit an extra `tool_call.done` for the placeholder id (empty args) when closing stale state — see `test/fixtures/cohere/tool-late-id.jsonl` (**LSA-CO77**, **LSA-CO78**).

Use `cohereAdapter()` as the reference pattern for nested `delta.message` v2 envelopes on SSE. Fixtures: `test/fixtures/cohere/`. Example: [`examples/node-fetch/cohere.ts`](../examples/node-fetch/cohere.ts). Worker proxy: [`examples/integrations/cohere-proxy.ts`](../examples/integrations/cohere-proxy.ts).

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

Use `resolveCompatibleAdapterConfig({ provider })` when you need resolved preset flags without constructing an adapter (since **1.3.6**).

## Assembler vs adapter state

- **Adapters** map one SSE/JSON payload → `RawChunk[]`. They must not accumulate text, tool args, or reasoning across payloads. Minimal per-stream state is allowed only for id/index reconciliation (e.g. OpenAI tool `index` before `id`).
- **`EventAssembler`** (core) is **stateful per stream**: it buffers text, reasoning, JSON, refusals, and open tool calls until `.done` / `finish` events. Public APIs create a **new assembler per** `assembleStream`, `assembleFromPayloads`, `assembleResponse`, or `createAssemblyTransform` call — do not share one instance across concurrent streams.
- **`EventAssembler.reset()`** clears all assembly state and is intended for **tests** or explicit reuse after a stream completes — not for multiplexing concurrent requests on one instance.
- **Transforms** (`tapEvents`, `toSSE`, `collectStream`) are stateless over the unified event stream.

See README Architecture lifecycle diagram (`docs/img/assembler-lifecycle.svg`) and [FAQ](./faq.md).

See [`test/fixtures/openai-compatible/README.md`](../test/fixtures/openai-compatible/README.md) and [`docs/live-smoke.md`](./live-smoke.md) checklist.

## Citation and grounding events (1.6.0+)

Since **1.6.0**, provenance payloads map to first-class **`citation`** and **`grounding`** `StreamEvent` types (atomic events — no delta/done lifecycle):

| Provider / surface             | Source fields                           | Unified mapping                                                 |
| ------------------------------ | --------------------------------------- | --------------------------------------------------------------- |
| Cohere v2                      | `citation-start`                        | `citation` with optional `span`, `sources`, `index`             |
| Perplexity (OpenAI-compatible) | root `citations`, `search_results`      | `citation` with `urls`, `searchResults`                         |
| Gemini Google AI + Vertex      | `citationMetadata`, `groundingMetadata` | `citation` then `grounding` before text parts on same candidate |

**Migration:** adapters default to typed events only. Set **`emitLegacyCitationMetadata: true`** on `cohereAdapter`, `geminiAdapter`, or `openaiCompatibleAdapter` to dual-emit legacy `metadata.raw` citation blobs during migration — deprecated; remove when consumers handle typed events.

**Helpers:** `isCitation`, `isGrounding`, `matchEvent` handlers, `collectStream` → `citations` / `grounding` arrays, **`citationSpanAnchor()`** for Cohere span alignment.

**Conformance:** every built-in adapter with citation fixtures has golden parity coverage — **LSA-CF01** (Cohere), **CF02** (Perplexity), **CF03** (Vertex grounding), **CF04** (Google AI grounding SSE). See `test/citation-grounding-conformance.test.ts`.

## Logprob events (1.7.0+)

Since **1.7.0**, OpenAI Chat Completions and OpenAI-compatible presets map `choices[].logprobs` to first-class **`logprob`** `StreamEvent` types when the upstream request enables logprobs. Events are **atomic per token** — no delta/done lifecycle.

| Provider field                           | Unified mapping                                                                 |
| ---------------------------------------- | ------------------------------------------------------------------------------- |
| `choices[].logprobs.content[]`           | `logprob` with `channel: "content"`, `token`, `logprob`, optional `topLogprobs` |
| `choices[].logprobs.refusal[]`           | `logprob` with `channel: "refusal"`                                             |
| `choices[].logprobs: null`               | no events (provider omitted logprobs for this chunk)                            |
| Non-stream `message.logprobs` (response) | same mapping via `parseResponse` / `assembleResponse`                           |

**Request prerequisites:** the caller must set `logprobs: true` on the Chat Completions request (and optionally `top_logprobs: N`). Adapters do not infer logprobs from response shape alone — absent or `null` logprobs emit nothing.

**Ordering:** on each chunk, logprob events for newly arrived tokens are emitted **before** sibling `text.delta`, `refusal.delta`, or `json.delta` events from the same choice. Streaming uses monotonic `position` per `(choiceIndex, channel)` via adapter position state (**LSA-LPH01**–**LPH04**).

**Multi-choice:** `choiceIndex` is preserved when the provider sends multiple choices in one chunk (**LSA-LP15**, fixture `logprobs-multichoice`).

**Helpers:** `isLogprob`, `matchEvent` handlers, `collectStream` → `logprobs` array, **`logprobConfidence()`** (probability + margin from `topLogprobs`), **`alignLogprobsWithText()`** (token offsets vs assembled text).

**Not mapped in 1.7.0:** OpenAI **Responses API** logprobs — deferred until a dedicated Responses mapping lands.

Fixtures: `test/fixtures/openai-chat/logprobs-*`, `test/fixtures/openai-compatible/logprobs-stream.sse`. Regenerate: `node scripts/generate-openai-logprob-fixtures.mjs`.

## Community adapters

Third-party adapters (Bedrock, etc.) can follow this guide in separate packages or PRs — core types (`StreamAdapter`, `RawChunk`, `StreamEvent`) are exported from `llm-stream-assemble/core`.
