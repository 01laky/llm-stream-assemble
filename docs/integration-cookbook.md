# Integration cookbook

**Status:** Active guide — `1.5.6` (initial cookbook shipped in `1.3.6`)

Wire unified `StreamEvent`s into your application stack. This library is the **assembly layer** — integrations connect `assembleStream` / `toSSE` / `collectStream` to framework boundaries. For provider setup, see [Quick decision guide](../README.md#quick-decision-guide). For proxy safety, see [`examples/proxy-safety/`](../examples/proxy-safety/).

---

## Prerequisites

- Node.js 18+ (Web `Request` / `Response`, `TransformStream`)
- An adapter choice — [compatibility matrix](./compatibility.md)
- Secrets stay server-side — never expose API keys to browsers ([proxy-safety README](../examples/proxy-safety/README.md))

---

## Decision table

| I use…                            | Start here                                                                                                                        | Also see                                                                                                                              |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Hono / Elysia / Web `Request`     | [`hono-proxy.ts`](../examples/integrations/hono-proxy.ts)                                                                         | [`web-standard-proxy.ts`](../examples/proxy-safety/web-standard-proxy.ts)                                                             |
| Express / Fastify (Node HTTP)     | [`express-proxy.ts`](../examples/integrations/express-proxy.ts)                                                                   | proxy-safety README                                                                                                                   |
| Cloudflare Workers (edge proxy)   | [`cloudflare-worker-proxy.ts`](../examples/integrations/cloudflare-worker-proxy.ts)                                               | [`rest-chat-completions.ts`](../examples/workers-ai/rest-chat-completions.ts) (client)                                                |
| AWS Bedrock on Cloudflare Workers | [`bedrock-worker-proxy.ts`](../examples/integrations/bedrock-worker-proxy.ts)                                                     | [`decode-event-stream.ts`](../examples/bedrock/decode-event-stream.ts) + [`node-fetch/bedrock.ts`](../examples/node-fetch/bedrock.ts) |
| Cohere Chat v2 on Workers / edge  | [`cohere-proxy.ts`](../examples/integrations/cohere-proxy.ts)                                                                     | [`node-fetch/cohere.ts`](../examples/node-fetch/cohere.ts) — SSE via `cohereAdapter()` (not OpenAI-compatible)                        |
| Vertex AI Gemini (Node server)    | [`vertex-gemini.ts`](../examples/node-fetch/vertex-gemini.ts) + [`read-chunk-stream.ts`](../examples/vertex/read-chunk-stream.ts) | README [Vertex AI Gemini Usage](../README.md#vertex-ai-gemini) — JSONL boundary, ADC bearer auth                                      |
| LiteLLM / local OpenAI proxy      | [`litellm-openai-compatible.ts`](../examples/integrations/litellm-openai-compatible.ts)                                           | [OpenAI-compatible Usage](../README.md#openai-compatible-usage)                                                                       |
| OpenRouter                        | [OpenAI-compatible Usage](../README.md#openai-compatible-usage) (`provider: "openrouter"`)                                        | not LiteLLM file                                                                                                                      |
| Vercel AI SDK                     | [`stream-event-to-ai-sdk-parts.ts`](../examples/integrations/stream-event-to-ai-sdk-parts.ts)                                     | [comparison](./comparison.md)                                                                                                         |
| LangChain.js                      | [`langchain-callback-pattern.ts`](../examples/integrations/langchain-callback-pattern.ts)                                         | [comparison](./comparison.md)                                                                                                         |
| Next.js App Router                | [`nextjs-app-route.ts`](../examples/integrations/nextjs-app-route.ts)                                                             | Edge vs Node notes below                                                                                                              |
| Non-streaming JSON API            | [`collect-stream-handler.ts`](../examples/integrations/collect-stream-handler.ts)                                                 | Node-only (`assembleFromFile`)                                                                                                        |
| TransformStream middleware        | [`assembly-transform-pipeline.ts`](../examples/integrations/assembly-transform-pipeline.ts)                                       | `createAssemblyTransform`                                                                                                             |

---

## Hono

Hono exposes the incoming Web `Request` as `c.req.raw` — delegate to the shared proxy handler:

```ts
// app.post("/api/chat", (c) =>
//   handleHonoLLMProxy(c.req.raw, { apiKey: env.OPENAI_API_KEY }),
// );
```

Full example: [`examples/integrations/hono-proxy.ts`](../examples/integrations/hono-proxy.ts)

---

## Express (Node HTTP)

Convert `IncomingMessage` → Web `Request`, call `handleLLMProxyRequest`, pipe the `Response` body to `ServerResponse`. No `express` import required — pattern works with Express, Fastify raw replies, or plain `node:http`.

Full example: [`examples/integrations/express-proxy.ts`](../examples/integrations/express-proxy.ts)

CORS and auth are your app boundary — see proxy-safety threat model.

---

## Cloudflare Worker (edge proxy)

Browser → your Worker → upstream LLM. Uses Web APIs only (**no `node:fs`**). Set `env.LLM_PROVIDER` to `"cloudflare"` for Workers AI or `"openai"` for OpenAI Chat upstream.

```ts
export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		return handleWorkerLLMProxy(request, env);
	},
};
```

Full example: [`examples/integrations/cloudflare-worker-proxy.ts`](../examples/integrations/cloudflare-worker-proxy.ts)

---

## AWS Bedrock on Cloudflare Workers

Browser → your Worker → Bedrock Runtime **ConverseStream**. The upstream response is often binary EventStream — pipe bytes through [`decodedBedrockEventPayloads`](../examples/bedrock/decode-event-stream.ts) (or AWS SDK decode) to yield JSON strings, then `assembleFromPayloads(..., bedrockAdapter())` and `toSSE(..., { sanitizeErrors: true })` to the client. IAM and signing remain your Worker boundary; this library only parses decoded JSON.

Full example: [`examples/integrations/bedrock-worker-proxy.ts`](../examples/integrations/bedrock-worker-proxy.ts)

---

## Cohere Chat v2 on Workers / edge

Browser → your Worker → `https://api.cohere.com/v2/chat` with `stream: true`. The upstream response is **SSE** — pass `response.body` to `assembleStream(..., cohereAdapter())` and re-emit with `toSSE(..., { sanitizeErrors: true })`. Do **not** use `openaiCompatibleAdapter()` for Cohere.

Full example: [`examples/integrations/cohere-proxy.ts`](../examples/integrations/cohere-proxy.ts)

---

## Vertex AI Gemini (Node)

Server → Vertex `streamGenerateContent` → split JSONL (or brace-balanced chunks) → `assembleFromPayloads` → optional `toSSE` to browser.

1. Build URL with [`buildVertexStreamUrl`](../examples/vertex/build-vertex-url.ts) (`GOOGLE_CLOUD_PROJECT`, `VERTEX_LOCATION`, model id).
2. `fetch` with `Authorization: Bearer <adc-token>` — obtain token server-side (`gcloud auth application-default print-access-token` or your metadata service).
3. Pipe `response.body` through [`readVertexJsonlStrings`](../examples/vertex/read-chunk-stream.ts) (or `readVertexChunkStrings` when the API returns a streamed JSON array).
4. `assembleFromPayloads(lines, geminiAdapter({ apiSurface: "vertex" }))` then forward unified events (proxy-safety applies if the client is a browser).

Full example: [`examples/node-fetch/vertex-gemini.ts`](../examples/node-fetch/vertex-gemini.ts). Do **not** reuse Google AI `?alt=sse` + `GOOGLE_API_KEY` against the Vertex host.

---

## LiteLLM / OpenAI-compatible proxy

LiteLLM serves OpenAI-shaped `/v1/chat/completions`. Use `openaiCompatibleAdapter({ provider: "generic" })`.

**Environment variables:**

| Variable           | Purpose                                              |
| ------------------ | ---------------------------------------------------- |
| `LITELLM_BASE_URL` | e.g. `http://localhost:4000/v1` (must include `/v1`) |
| `LITELLM_API_KEY`  | Bearer token for LiteLLM                             |
| `LITELLM_MODEL`    | Model name routed by LiteLLM                         |

**Alternative:** reuse `OPENAI_COMPATIBLE_BASE_URL`, `OPENAI_COMPATIBLE_API_KEY`, and `OPENAI_COMPATIBLE_MODEL` — `runLiteLLMCompatibleExample` accepts either set. See [`.env.example`](../.env.example).

Full example: [`examples/integrations/litellm-openai-compatible.ts`](../examples/integrations/litellm-openai-compatible.ts)

---

## Vercel AI SDK (manual mapping)

This library does **not** ship an official `@ai-sdk/*` plugin (zero runtime deps). Map events with `mapStreamEventToAISDKPart` inside your stream controller — mapping is **illustrative**; verify against your SDK version.

Full example: [`examples/integrations/stream-event-to-ai-sdk-parts.ts`](../examples/integrations/stream-event-to-ai-sdk-parts.ts)

---

## LangChain.js (callback pattern)

`createLangChainHandlerAdapter` accepts LangChain-shaped handlers without importing `langchain`:

- `text.delta` → `handleLLMNewToken`
- `tool_call.start` / `tool_call.args.delta` → `handleToolStart`
- `tool_call.done` → `handleToolEnd`

Full example: [`examples/integrations/langchain-callback-pattern.ts`](../examples/integrations/langchain-callback-pattern.ts)

---

## Next.js App Router

`handleNextAppRoutePost` wraps the shared proxy handler for Route Handlers:

```ts
// app/api/chat/route.ts
// export async function POST(request: Request) {
//   return handleNextAppRoutePost(request, { apiKey: process.env.OPENAI_API_KEY });
// }
```

- **Edge runtime:** streaming fetch + `assembleStream` OK; **`assembleFromFile` is Node-only**
- **Node runtime:** all transforms and replay helpers available

Full example: [`examples/integrations/nextjs-app-route.ts`](../examples/integrations/nextjs-app-route.ts)

---

## `collectStream` for non-streaming handlers

Materialize the full stream when your HTTP handler returns JSON instead of SSE:

```ts
const collected = await collectStream(assembleStream(body, adapter));
return Response.json({ text: collected.text, finish: collected.finishReason });
```

Node replay: [`collect-stream-handler.ts`](../examples/integrations/collect-stream-handler.ts) uses `assembleFromFile` on golden fixtures.

---

## `createAssemblyTransform` pipeline

Alternative to `for await (assembleStream(…))` — pipe upstream bytes through a Web `TransformStream`:

```ts
const events = upstream.body!.pipeThrough(createAssemblyTransform(adapter));
return new Response(toSSE(events, { sanitizeErrors: true }), { headers: { … } });
```

Full example: [`examples/integrations/assembly-transform-pipeline.ts`](../examples/integrations/assembly-transform-pipeline.ts)

---

## Offline replay → mapper

Prove integration mapping without HTTP mocks:

```ts
const parts = await mapFixtureEventsToAISDKParts({
	fixturePath: "test/fixtures/openai-chat/text-basic.sse",
});
```

Full example: [`examples/integrations/replay-integration-mapper.ts`](../examples/integrations/replay-integration-mapper.ts)

---

## Non-goals

- Official framework plugins or peer dependencies on Hono, Express, AI SDK, LangChain
- Agent orchestration, tool execution, persistence
- Markdown/XML tag parsing inside model text ([edge-cases](./edge-cases.md))

---

## Edge cases & failure modes

Integration recipes reuse the same proxy safety and assembly guarantees as [`examples/proxy-safety/`](../examples/proxy-safety/). Offline regression tests in `test/examples/integration-cookbook.test.ts` and `test/examples/integration-cookbook-edge.test.ts` lock these behaviors.

| Scenario                                  | Expected behavior                                                 | Test                                        |
| ----------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------- |
| Invalid JSON body (Worker)                | `400` JSON error payload, no upstream call                        | **LSA-INT21**                               |
| Missing `messages` / `prompt` (Worker)    | `400` validation error                                            | **LSA-INT22**                               |
| Missing server API key (Worker / Next.js) | Safe `500` — no secret leakage                                    | **LSA-INT23**, **LSA-INT38**                |
| Cloudflare Workers AI upstream            | `LLM_PROVIDER=cloudflare` + account/token env                     | **LSA-INT24**                               |
| Provider stream error                     | Sanitized SSE to client; raw error only in `logEvent`             | **LSA-INT04**, **LSA-INT25**, **LSA-INT36** |
| Upstream HTTP failure                     | `502` + generic message, body redacted                            | **LSA-INT34**                               |
| Client disconnect                         | `request.signal` forwarded to upstream fetch                      | **LSA-INT26**                               |
| LiteLLM env missing                       | Clear throw before network (`LITELLM_*` or `OPENAI_COMPATIBLE_*`) | **LSA-INT07**, **LSA-INT27**, **LSA-INT28** |
| AI SDK mapper unknown events              | Returns `null` — caller skips unmapped kinds                      | **LSA-INT30**                               |
| AI SDK mapper error without `sanitized`   | Default safe client message                                       | **LSA-INT31**                               |
| LangChain partial tool JSON               | `tool_call.args.delta` accumulates in callback input              | **LSA-INT32**                               |
| Non-streaming handler                     | `collectStream` + `assembleFromFile` (Node-only)                  | **LSA-INT35**                               |
| Fixture → mapper E2E                      | No HTTP mock — golden SSE → AI SDK parts                          | **LSA-INT19**, **LSA-INT37**                |

**Runtime notes:**

- **Edge (Workers, Vercel Edge):** streaming `fetch` + `assembleStream` / `createAssemblyTransform` — no `node:fs`, no `assembleFromFile`.
- **Node:** all transforms, replay helpers, and `collectStream` examples available.
- **CORS / auth:** your app boundary — see proxy-safety README.

---

## Related docs

- [Edge-case showcase](./edge-cases.md)
- [FAQ](./faq.md)
- [How this compares](./comparison.md)
- [Examples index](../examples/README.md)
