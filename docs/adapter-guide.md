# Adapter author guide

**Status:** Draft (Phase 0) — golden-test fixtures land in Phase 1.

How to add or extend a provider adapter for `llm-stream-assemble`.

## Prerequisites

- Read [`proposal.md`](./proposal.md) § Provider Adapters and § Unified Event Model.
- Adapters emit **raw chunks** only — cross-chunk assembly lives in core.

## Steps

### 1. Capture fixtures

- Record redacted `.sse` or `.json` files under `test/fixtures/<adapter-name>/`.
- Never commit API keys or private data.
- Include edge cases: empty deltas, unicode, parallel tools, large tool args.

### 2. Implement `parseChunk`

- Input: one SSE `data:` payload string (or JSONL line).
- Output: `RawChunk[]` — zero or more chunks.
- Do **not** accumulate text, tool args, or reasoning across calls.

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

### 6. Update compatibility matrix

Add or update the row in [`compatibility.md`](./compatibility.md) with accurate feature flags.

### 7. Pull request

- Fixture + golden test required for any adapter change.
- Run `pnpm verify` before opening PR.
- Follow [CONTRIBUTING.md](../CONTRIBUTING.md).

## Factory naming convention

| Provider                | Export                      |
| ----------------------- | --------------------------- |
| OpenAI Chat             | `openaiChatAdapter()`       |
| OpenAI-compatible hosts | `openaiCompatibleAdapter()` |
| Anthropic Messages      | `anthropicAdapter()`        |
| OpenAI Responses        | `openaiResponsesAdapter()`  |

## Community adapters

Third-party adapters (Gemini, Bedrock, etc.) can follow this guide in separate packages or PRs — core types (`StreamAdapter`, `RawChunk`, `StreamEvent`) are exported from `llm-stream-assemble/core`.
