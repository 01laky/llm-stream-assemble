# FAQ

**Status:** Active guide — `1.3.6`

Common questions about streaming assembly, lifecycle, and positioning.

---

## Why do I get `text.delta` but no `text.done` until the stream ends?

Assembly **buffers** partial text so it can emit a complete `text.done` with the full string. Deltas are for live UI; `.done` events mark completion. If the stream aborts or ends without a terminal finish, call patterns may flush on close — see `assembleStream` abort handling and `EventAssembler.flush()`.

---

## Can I reuse one adapter across concurrent requests?

**Create one adapter instance per request/stream.** Adapters may keep minimal per-stream state (e.g. OpenAI tool-call index → id mapping). Sharing one adapter across concurrent streams can mix that state.

---

## Can I share one `EventAssembler` between streams?

**No.** `EventAssembler` is stateful (text buffers, open tool calls, finish flag). Public APIs (`assembleStream`, `assembleFromPayloads`, `assembleResponse`, `createAssemblyTransform`) construct a **new assembler per call**. Use `reset()` only in tests or advanced reuse — not for concurrent streams.

---

## Why is Anthropic tool input sometimes invalid JSON mid-stream?

Anthropic **fine-grained tool streaming** sends `input_json_delta` fragments. Until the content block ends, concatenated input may not be valid JSON. Core emits `tool_call.args.delta` for preview; `tool_call.done` parses args when the block completes (best-effort partial JSON preview uses `parsePartialJSON`).

---

## How do I proxy streams safely to a browser?

1. Assemble on the server with `assembleStream`.
2. Log/observe with `tapEvents` (server only).
3. Forward to the client with `toSSE(events, { sanitizeErrors: true })`.

Never forward raw provider error blobs or upstream non-OK bodies. See [`examples/proxy-safety/`](../examples/proxy-safety/) and README Proxy safety.

---

## How is this different from the Vercel AI SDK?

AI SDKs bundle **HTTP, React hooks, agents, and provider integrations**. This library is **only** the stream assembly layer on top of bytes you already fetched. See [comparison](./comparison.md).

---

## Does JSON mode return parsed objects while streaming?

**No.** JSON mode maps provider content to `json.delta` / `json.done` events with string payloads. Parse `json.done` when you need an object, or use `collectStream()` to materialize the full stream (memory cost).

Use `openaiChatAdapter({ jsonMode: true })`, `openaiCompatibleAdapter({ jsonMode: true })`, or `geminiAdapter({ jsonMode: true })` depending on provider.

---

## Why not just concatenate SSE chunks?

Raw LLM streams split JSON across chunks, use different event shapes per provider, interleave tool args and reasoning, and emit lifecycle markers like `[DONE]` separately from finish reasons. Concatenation breaks in production edge cases — see README [Why not just concatenate?](../README.md#why-not-just-concatenate).

**Where are the concrete edge-case examples?** → [docs/edge-cases.md](./edge-cases.md) — SSE splits, tool JSON partials, JSON mode, DIY vs `assembleStream`, and `assembleFromFile` replay.

---

## Does this library make HTTP calls?

**No.** You provide `fetch`, auth headers, and URLs. The library parses `response.body` bytes or non-stream JSON only.

---

## How do I run the smoke benchmark locally?

```bash
pnpm build
pnpm bench:smoke
```

Replicates **LSA-C52** (10k SSE payloads). See [performance](./performance.md).

---

## How do I integrate with Hono, Express, Cloudflare Workers, or the Vercel AI SDK?

→ [docs/integration-cookbook.md](./integration-cookbook.md) — copy-paste recipes under `examples/integrations/` (Hono, Express, Workers, LiteLLM, Next.js, AI SDK mapping, LangChain callbacks). No official framework plugin — zero runtime dependencies.

---

## Does this parse markdown or XML tags from model output?

**No.** It normalizes **provider protocol events** (SSE/JSON payloads), not arbitrary tags inside generated text. Render `text.delta` in your UI/markdown renderer separately.
