# Integrations

Stack-specific recipes that wire `assembleStream`, `toSSE`, and unified `StreamEvent`s into your framework boundary. Full guide: [`docs/integration-cookbook.md`](../docs/integration-cookbook.md).

| File                              | Stack                             | Key export                            |
| --------------------------------- | --------------------------------- | ------------------------------------- |
| `hono-proxy.ts`                   | Hono / Web `Request`              | `handleHonoLLMProxy`                  |
| `express-proxy.ts`                | Express-style Node HTTP           | `createExpressProxyHandler`           |
| `cloudflare-worker-proxy.ts`      | Workers edge proxy                | `handleWorkerLLMProxy`                |
| `bedrock-worker-proxy.ts`         | Bedrock ConverseStream on Workers | `handleBedrockWorkerProxy`            |
| `litellm-openai-compatible.ts`    | LiteLLM OpenAI-compatible proxy   | `runLiteLLMCompatibleExample`         |
| `stream-event-to-ai-sdk-parts.ts` | Vercel AI SDK (manual map)        | `mapStreamEventToAISDKPart`           |
| `langchain-callback-pattern.ts`   | LangChain-style callbacks         | `createLangChainHandlerAdapter`       |
| `collect-stream-handler.ts`       | Non-streaming handlers (Node)     | `runCollectStreamHandlerExample`      |
| `assembly-transform-pipeline.ts`  | `createAssemblyTransform` pipe    | `runAssemblyTransformPipelineExample` |
| `nextjs-app-route.ts`             | Next.js App Router                | `handleNextAppRoutePost`              |
| `replay-integration-mapper.ts`    | Fixture → mapper (offline)        | `mapFixtureEventsToAISDKParts`        |

See also [`../proxy-safety/`](../proxy-safety/) for the generic Web-standard proxy and browser client.

All modules are import-safe (no network on import). Pass `fetchImpl` in tests and CI.
