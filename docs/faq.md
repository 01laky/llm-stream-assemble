# FAQ

**Status:** Active guide — `1.5.5`

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

Use `openaiChatAdapter({ jsonMode: true })`, `openaiCompatibleAdapter({ jsonMode: true })`, or `geminiAdapter({ jsonMode: true })` depending on provider. On Vertex, combine with `apiSurface: "vertex"`.

---

## Google AI Gemini vs Vertex AI — same adapter?

**Yes — one `geminiAdapter()` with `apiSurface`.** Default **`"google-ai"`** expects `GenerateContentResponse` JSON inside Google AI SSE `data:` lines (`assembleStream` + `parseSSE`). **`"vertex"`** runs **`normalizeVertexChunk()`** first to unwrap `{ response }`, `{ result }`, or `{ predictions[0] }`, then maps the same candidate / tool / usage fields.

**Differences that stay in your app:**

| Topic        | Google AI                           | Vertex AI                                                                     |
| ------------ | ----------------------------------- | ----------------------------------------------------------------------------- |
| Host         | `generativelanguage.googleapis.com` | `{region}-aiplatform.googleapis.com`                                          |
| Auth         | API key query param or header       | Bearer token (ADC) — not `GOOGLE_API_KEY` on Vertex URL                       |
| Stream bytes | SSE `data:` lines                   | Often JSONL or streamed JSON array — split before `parseChunk`                |
| Assembly API | `assembleStream(response.body, …)`  | `assembleFromPayloads(lineIterator, geminiAdapter({ apiSurface: "vertex" }))` |

Examples: [`examples/node-fetch/gemini.ts`](../examples/node-fetch/gemini.ts), [`examples/node-fetch/vertex-gemini.ts`](../examples/node-fetch/vertex-gemini.ts). Live smoke: `pnpm smoke:vertex` — [live-smoke](./live-smoke.md).

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

## Does this library handle AWS signing or EventStream decoding for Bedrock?

**No.** `bedrockAdapter()` accepts **decoded ConverseStream JSON strings** — one envelope object per `parseChunk` call. Binary AWS EventStream framing, IAM credentials, and SigV4 request signing stay in your application, AWS SDK (`ConverseStreamCommand` async iterator), or the educational helper in [`examples/bedrock/decode-event-stream.ts`](../examples/bedrock/decode-event-stream.ts).

Feed decoded lines to `assembleFromPayloads` or frame them as pseudo-SSE for `assembleStream`. See README [Bedrock Usage](../README.md#bedrock-usage) and [`examples/bedrock/README.md`](../examples/bedrock/README.md).

---

## Is Cohere OpenAI-compatible?

**No — Cohere is not OpenAI-compatible.** Cohere Chat **v2** uses its own SSE event types (`message-start`, `content-delta`, `tool-plan-delta`, `tool-call-*`, `citation-start`, `message-end`). Use **`cohereAdapter()`** with **`assembleStream(response.body, cohereAdapter())`** — core `parseSSE()` handles SSE line framing.

Do **not** point `openaiCompatibleAdapter()` at Cohere — you will miss tool-plan reasoning, citations, and finish/usage mapping. See README [Cohere Usage](../README.md#cohere-usage) and [`examples/node-fetch/cohere.ts`](../examples/node-fetch/cohere.ts).

**Tool plan:** `tool-plan-delta` maps to `reasoning.*` with `variant: "detail"` (model planning text before tool calls).

**Citations:** `citation-start` payloads are preserved in **`metadata.raw`** — there are no dedicated `citation.*` unified events in 1.x.

---

## Does this parse markdown or XML tags from model output?

**No.** It normalizes **provider protocol events** (SSE/JSON payloads), not arbitrary tags inside generated text. Render `text.delta` in your UI/markdown renderer separately.
