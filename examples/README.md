# Examples

These examples are small TypeScript snippets that use plain `fetch` and the public
`llm-stream-assemble` API. They do not run on import and they are tested with fake
fetch responses in CI; no live provider calls are made by default.

## Node fetch examples

- `examples/node-fetch/openai-chat.ts` — OpenAI Chat Completions streaming.
- `examples/node-fetch/openai-compatible.ts` — OpenAI-compatible providers (`OPENAI_COMPATIBLE_PROVIDER` preset: `groq`, `deepseek`, `mistral`, `ollama`, …).
- `examples/node-fetch/anthropic.ts` — Anthropic Messages streaming.
- `examples/node-fetch/gemini.ts` — Google Gemini `streamGenerateContent` (SSE).
- `examples/node-fetch/perplexity.ts` — Perplexity OpenAI-compatible streaming (`provider: "perplexity"`).
- `examples/node-fetch/xai.ts` — xAI Grok OpenAI-compatible streaming (`provider: "xai"`).
- `examples/node-fetch/replay-fixture.ts` — local fixture replay with `assembleFromFile`.

Required environment variables when running manually:

- `OPENAI_API_KEY`
- `OPENAI_COMPATIBLE_BASE_URL`
- `OPENAI_COMPATIBLE_API_KEY`
- `OPENAI_COMPATIBLE_MODEL`
- `OPENAI_COMPATIBLE_PROVIDER` (optional — `generic`, `groq`, `deepseek`, `mistral`, `ollama`, `openrouter`, `perplexity`, `xai`, …)
- `DEEPSEEK_API_KEY`, `GROQ_API_KEY`, `MISTRAL_API_KEY` (when using matching host)
- `PERPLEXITY_API_KEY`, `PERPLEXITY_BASE_URL`, `PERPLEXITY_MODEL` (Perplexity example / smoke)
- `XAI_API_KEY`, `XAI_BASE_URL`, `XAI_MODEL` (xAI Grok example / smoke)
- `OLLAMA_BASE_URL`, `OLLAMA_MODEL` (local Ollama smoke — see [docs/live-smoke.md](../docs/live-smoke.md))
- `ANTHROPIC_API_KEY`
- `GOOGLE_API_KEY` or `GEMINI_API_KEY` (Gemini example accepts either)

The examples accept injected `fetchImpl` and `write` callbacks so tests do not
write to stdout or call the network. Environment variables are read inside exported
functions, never at module import time.

Optional CLI guards may be added later, but the modules must remain side-effect
free when imported.

## Proxy safety

See `examples/proxy-safety/` for Web-standard proxy snippets using `tapEvents` for
server-side observation and `toSSE(events, { sanitizeErrors: true })` for
browser-facing streams.
