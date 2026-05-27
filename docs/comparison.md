# How this compares

**Status:** Active guide — `1.4.0`

Where `llm-stream-assemble` fits relative to common alternatives. Comparisons are **best-effort** — other packages evolve independently; verify before choosing.

---

## Positioning in one sentence

> A **zero-dependency stream assembly primitive**: provider bytes → unified `StreamEvent`s. Not an HTTP client, agent framework, or UI kit.

---

## Comparison matrix

| Category                       | Examples                                                                           | What they optimize for                                           | `llm-stream-assemble`                                                                                         |
| ------------------------------ | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Full-stack AI SDKs**         | [Vercel AI SDK](https://sdk.vercel.ai/), LangChain.js                              | End-to-end apps: hooks, agents, tool execution, provider clients | **Lower level** — you keep fetch, auth, UI, and agent loop                                                    |
| **Provider SDKs**              | `openai`, `@anthropic-ai/sdk`                                                      | Vendor-native types and RPC                                      | **Unified `StreamEvent`** across OpenAI, Anthropic, Gemini, compatible hosts                                  |
| **Schema stream parsers**      | [`zod-stream`](https://www.npmjs.com/package/zod-stream) (Zod on streams)          | Validated structured output while streaming                      | **Event normalization first**; use `json.*` events + your validator, or `strictToolArgs` at completion        |
| **Generic LLM stream parsers** | [`llm-stream-parser`](https://www.npmjs.com/package/llm-stream-parser) and similar | Parsing provider-specific stream shapes                          | **Typed adapters + golden fixtures** per provider dialect; explicit preset options                            |
| **Tag / XML stream parsers**   | Various markdown/XML tag parsers                                                   | Extract tagged regions from model text                           | **Out of scope** — we normalize provider protocol events, not arbitrary tags in content                       |
| **DIY concatenation**          | Manual `JSON.parse` on each SSE chunk                                              | Minimal code for happy-path demos                                | **Breaks on real edge cases** — see README [Why not just concatenate?](../README.md#why-not-just-concatenate) |

---

## Four differentiators

1. **Simplicity** — one job: assemble provider streams into typed events.
2. **Lower level** — plain `fetch`, your proxy, your persistence.
3. **Composable** — adapters, `tapEvents`, `toSSE`, `TransformStream`, fixture replay.
4. **Framework agnostic** — Node, Workers, Deno; no React requirement.

---

## When to use this

- Backend proxy normalizing LLM SSE before the browser
- Agent loop where you already own HTTP and want one event model across providers
- Switching OpenAI ↔ Anthropic ↔ Groq without rewriting parsers
- Golden-file testing provider stream dialects

---

## When **not** to use this

| You want…                                         | Better fit                           |
| ------------------------------------------------- | ------------------------------------ |
| Ready-made React chat UI                          | Vercel AI SDK, similar               |
| Zod-validated structured output stream end-to-end | Schema-focused stream tools          |
| Built-in tool execution and memory                | LangChain, AI SDK agents             |
| XML/markdown tag parsing from model text          | Tag parser libraries (non-goal here) |
| Provider SDK features (files, batches, admin API) | Official vendor SDK                  |

See also [FAQ](./faq.md) and README [Non-goals](../README.md#non-goals).
