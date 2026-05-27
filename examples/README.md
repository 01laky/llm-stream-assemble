# Examples

These examples are small TypeScript snippets that use plain `fetch` and the public
`llm-stream-assemble` API. They do not run on import and they are tested with fake
fetch responses in CI; no live provider calls are made by default.

## When to use which example

| Goal                                                                  | Start here                                                                                      |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| OpenAI Chat Completions streaming                                     | `node-fetch/openai-chat.ts`                                                                     |
| Local Ollama or other compatible host                                 | `node-fetch/openai-compatible.ts` (`provider: "ollama"`, …)                                     |
| Anthropic Messages                                                    | `node-fetch/anthropic.ts`                                                                       |
| Google AI Gemini SSE                                                  | `node-fetch/gemini.ts`                                                                          |
| Vertex AI Gemini JSONL stream                                         | `node-fetch/vertex-gemini.ts` + `vertex/read-chunk-stream.ts`                                   |
| AWS Bedrock ConverseStream (decoded JSON)                             | `node-fetch/bedrock.ts` + [`bedrock/README.md`](./bedrock/README.md)                            |
| Cohere Chat v2 SSE                                                    | `node-fetch/cohere.ts`                                                                          |
| Azure / Cloudflare / Perplexity / xAI                                 | matching `node-fetch/*.ts` or `workers-ai/`                                                     |
| Proxy unified SSE to a browser                                        | `proxy-safety/`                                                                                 |
| Replay a checked-in fixture offline                                   | `node-fetch/replay-fixture.ts`                                                                  |
| Wire into Hono, Express, Workers, LiteLLM, Next.js, AI SDK, LangChain | [`integrations/`](./integrations/) + [integration-cookbook.md](../docs/integration-cookbook.md) |

Full README index: [Examples](../README.md#examples).

## Live smoke commands

Maintainer-only — requires `pnpm build` and API keys. See [`docs/live-smoke.md`](../docs/live-smoke.md).

| Example file                      | Matching smoke command               | Notes                                     |
| --------------------------------- | ------------------------------------ | ----------------------------------------- |
| `node-fetch/gemini.ts`            | `pnpm smoke:gemini`                  | Google AI key; optional `--capture`       |
| `node-fetch/vertex-gemini.ts`     | `pnpm smoke:vertex`                  | ADC bearer token, not Google AI key       |
| `node-fetch/cohere.ts`            | `pnpm smoke:cohere`                  | Optional `--capture`                      |
| `node-fetch/bedrock.ts`           | `pnpm smoke:bedrock`                 | AWS credential chain                      |
| `node-fetch/openai-compatible.ts` | `pnpm smoke:ollama` / `deepseek` / … | Match `OPENAI_COMPATIBLE_PROVIDER` preset |

## OpenAI

- `examples/node-fetch/openai-chat.ts` — OpenAI Chat Completions streaming.

## Ollama & OpenAI-compatible

- `examples/node-fetch/openai-compatible.ts` — OpenAI-compatible providers (`OPENAI_COMPATIBLE_PROVIDER` preset: `groq`, `deepseek`, `mistral`, `ollama`, …).

## Anthropic

- `examples/node-fetch/anthropic.ts` — Anthropic Messages streaming.

## Google Gemini

- `examples/node-fetch/gemini.ts` — Google AI `streamGenerateContent?alt=sse` (SSE).
- `examples/node-fetch/vertex-gemini.ts` — Vertex AI `streamGenerateContent` (JSONL) with `apiSurface: "vertex"`.
- `examples/vertex/build-vertex-url.ts` — Vertex regional URL builder (examples only).
- `examples/vertex/read-chunk-stream.ts` — JSONL / brace-balanced chunk splitters (examples only).

## AWS Bedrock

- `examples/node-fetch/bedrock.ts` — AWS Bedrock ConverseStream (decoded JSON per event).

## Cohere Chat v2

- `examples/node-fetch/cohere.ts` — Cohere v2 `api.cohere.com/v2/chat` SSE via `assembleStream` + `cohereAdapter`.

## Other compatible hosts

- `examples/node-fetch/perplexity.ts` — Perplexity OpenAI-compatible streaming (`provider: "perplexity"`).
- `examples/node-fetch/xai.ts` — xAI Grok OpenAI-compatible streaming (`provider: "xai"`).
- `examples/node-fetch/azure-openai.ts` — Azure OpenAI Chat Completions (`provider: "azure"`, deployment URL + `api-key`).
- `examples/workers-ai/rest-chat-completions.ts` — Cloudflare Workers AI REST (`provider: "cloudflare"`, Bearer + account id).

## Streaming JSON & tool calling

Use `jsonMode: true` on the matching adapter when structured JSON should map to `json.*` events. Tool calls surface as `tool_call.args.delta` and `tool_call.done` — see README Usage guides and `test/fixtures/` goldens.

## Fixture replay

- `examples/node-fetch/replay-fixture.ts` — local fixture replay with `assembleFromFile`.

Required environment variables when running manually:

- `OPENAI_API_KEY`
- `OPENAI_COMPATIBLE_BASE_URL`
- `OPENAI_COMPATIBLE_API_KEY`
- `OPENAI_COMPATIBLE_MODEL`
- `OPENAI_COMPATIBLE_PROVIDER` (optional — `generic`, `groq`, `deepseek`, `mistral`, `ollama`, `openrouter`, `perplexity`, `xai`, `azure`, `cloudflare`, …)
- `DEEPSEEK_API_KEY`, `GROQ_API_KEY`, `MISTRAL_API_KEY` (when using matching host)
- `PERPLEXITY_API_KEY`, `PERPLEXITY_BASE_URL`, `PERPLEXITY_MODEL` (Perplexity example / smoke)
- `XAI_API_KEY`, `XAI_BASE_URL`, `XAI_MODEL` (xAI Grok example / smoke)
- `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_RESOURCE`, `AZURE_OPENAI_DEPLOYMENT`, `AZURE_OPENAI_API_VERSION` (Azure OpenAI example / smoke)
- `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_MODEL` (Cloudflare Workers AI example / smoke)
- `OLLAMA_BASE_URL`, `OLLAMA_MODEL` (local Ollama smoke — see [docs/live-smoke.md](../docs/live-smoke.md))
- `ANTHROPIC_API_KEY`
- `GOOGLE_API_KEY` or `GEMINI_API_KEY` (Google AI Gemini example accepts either)
- `GOOGLE_CLOUD_PROJECT`, `VERTEX_LOCATION`, `VERTEX_MODEL`, `VERTEX_ACCESS_TOKEN` (Vertex example / `pnpm smoke:vertex`)
- `AWS_REGION`, `BEDROCK_MODEL_ID` (Bedrock example / smoke — plus standard AWS credential chain)
- `COHERE_API_KEY`, `COHERE_MODEL`, `COHERE_SMOKE_TOOLS` (Cohere v2 example / smoke)

The examples accept injected `fetchImpl` and `write` callbacks so tests do not
write to stdout or call the network. Environment variables are read inside exported
functions, never at module import time.

Optional CLI guards may be added later, but the modules must remain side-effect
free when imported.

## Proxy safety

See `examples/proxy-safety/` for Web-standard proxy snippets using `tapEvents` for
server-side observation and `toSSE(events, { sanitizeErrors: true })` for
browser-facing streams.

## Integrations

Stack wiring recipes under [`integrations/`](./integrations/) — Hono, Express, Cloudflare Worker proxy, LiteLLM, Next.js App Route, `collectStream`, `createAssemblyTransform`, AI SDK mapping, LangChain callbacks, and offline replay mapper. Guide: [docs/integration-cookbook.md](../docs/integration-cookbook.md).
