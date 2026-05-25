# Adapter author guide

**Status:** Draft (Phase 2) — OpenAI Chat is the first concrete reference adapter.

How to add or extend a provider adapter for `llm-stream-assemble`.

## Prerequisites

- Read [`proposal.md`](./proposal.md) § Provider Adapters and § Unified Event Model.
- Adapters emit **raw chunks** only — cross-chunk assembly lives in core.
- Use `src/adapters/openai-chat.ts` and `test/fixtures/openai-chat/` as the reference implementation for mapping provider payloads into `RawChunk[]`.
- Use `openaiCompatibleAdapter()` as the reference pattern for reusing an existing parser with small dialect options instead of forking adapter logic.

## Steps

### 1. Capture fixtures

- Record redacted `.sse` or `.json` files under `test/fixtures/<adapter-name>/`.
- Never commit API keys or private data.
- Include edge cases: empty deltas, unicode, parallel tools, large tool args.
- Add a fixture provenance note when fixtures are synthetic, docs-shaped, or redacted-live.

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

## Factory naming convention

| Provider                | Export                      |
| ----------------------- | --------------------------- |
| OpenAI Chat             | `openaiChatAdapter()`       |
| OpenAI-compatible hosts | `openaiCompatibleAdapter()` |
| Anthropic Messages      | `anthropicAdapter()`        |
| OpenAI Responses        | `openaiResponsesAdapter()`  |

## Community adapters

Third-party adapters (Gemini, Bedrock, etc.) can follow this guide in separate packages or PRs — core types (`StreamAdapter`, `RawChunk`, `StreamEvent`) are exported from `llm-stream-assemble/core`.
