# llm-stream-assemble

![core](https://img.shields.io/badge/core-1.10.2-brightgreen)
![node](https://img.shields.io/badge/node-%3E%3D18-339933)
![runtime deps](https://img.shields.io/badge/runtime_deps-0-brightgreen)
![tests](https://img.shields.io/badge/tests-6738_passing-brightgreen)
[![ci](https://github.com/01laky/llm-stream-assemble/actions/workflows/ci.yml/badge.svg)](https://github.com/01laky/llm-stream-assemble/actions/workflows/ci.yml)
![status](https://img.shields.io/badge/status-stable_1.10.2-brightgreen)

**One typed event model for every LLM stream** — text, tools, reasoning, JSON, usage, refusals, citations, grounding, logprobs, errors, and non-streaming responses.

> A composable TypeScript layer between raw LLM provider bytes and your app: seven built-in adapters, thirteen host presets, and a single StreamEvent model for text, tools, reasoning, JSON, and lifecycle — from Ollama to Azure to Vertex AI to Bedrock to Cohere to Cloudflare Workers AI.

Turn provider SSE fragments into typed events — **not another `+=` loop**.

**Status:** Stable `1.10.2`. Review [CHANGELOG.md](./CHANGELOG.md) before major upgrades.

---

## Contents

- [Positioning](#positioning)
- [Why not just concatenate?](#why-not-just-concatenate)
- [Edge-case showcase](#edge-case-showcase)
- [Why use this](#why-use-this)
- [Install](#install)
- [Quickstart](#quickstart)
- [Architecture](#architecture)
- [Providers at a glance](#providers-at-a-glance)
- [Documentation](#documentation)
- [Usage guides](#usage-guides)
- [Examples](#examples)
- [Non-goals](#non-goals)
- [Development](#development)

---

## Positioning

`llm-stream-assemble` is the stream layer only: it parses provider payloads and emits unified typed events. You keep your own HTTP client, auth, retries, tool execution, and UI.

---

## Why not just concatenate?

Raw LLM streams are protocol events, not finished messages.

- **SSE boundaries split mid-line** across TCP reads; one read is not one JSON object.
- **Tool args stream as fragments** and become valid JSON only at completion.
- **Reasoning and text channels differ** and should not be merged blindly.
- **JSON mode streams partial strings** before `json.done`.
- **Lifecycle tails vary** (`[DONE]`, usage-only tails, incomplete streams).

Concrete fixtures and failing edge cases: [docs/edge-cases.md](./docs/edge-cases.md).

---

## Edge-case showcase

Three layers fail differently in production: SSE framing, tool/JSON assembly, and UI rendering.

![Chunk assembly: SSE fragments to unified events](https://raw.githubusercontent.com/01laky/llm-stream-assemble/main/docs/img/chunk-assembly.svg)

- **SSE mid-line split** requires line-buffer parsing.
- **Tool JSON partials** require incremental assembly.
- **JSON mode** emits deltas, then terminal `.done`.

Walkthrough with fixtures and test IDs: [docs/edge-cases.md](./docs/edge-cases.md).

---

## Why use this

- **Zero runtime dependencies**.
- **One event union for stream and non-stream flows**.
- **Provider adapters + host presets** instead of per-provider parser rewrites.
- **Proxy-safe transforms** (`toSSE`, `tapEvents`, `collectStream`) and fixture replay.

---

## Install

```bash
pnpm add llm-stream-assemble
# or npm install llm-stream-assemble
```

**Requirements:** Node.js 18+

## Runtimes

Node.js **18+** (CI on LTS 18, 20, 22). See [compatibility matrix](./docs/compatibility.md).

---

## Quickstart

```ts
import { assembleStream, openaiChatAdapter } from "llm-stream-assemble";

for await (const event of assembleStream(response.body!, openaiChatAdapter())) {
	if (event.type === "text.delta") process.stdout.write(event.text);
	if (event.type === "text.done") console.log("\n--- done:", event.text);
}
```

For provider-specific setup, request payloads, and caveats, use [docs/usage-guides.md](./docs/usage-guides.md).

---

## Architecture

Raw provider bytes enter through a thin adapter and exit as unified typed events.

### Lifecycle & concurrency

Adapters are **stateful per stream** — create a new adapter instance per request. The assembler supports **`reset()`** for reuse within a long-lived worker when needed.

![End-to-end pipeline](https://raw.githubusercontent.com/01laky/llm-stream-assemble/main/docs/img/pipeline.svg)

- Architecture diagrams: [docs/img/README.md](./docs/img/README.md)
- Adapter graph: [docs/img/adapters-overview.svg](./docs/img/adapters-overview.svg)
- Transforms: [docs/img/transforms.svg](./docs/img/transforms.svg)
- Quick decision guide: [docs/img/quick-decision.svg](./docs/img/quick-decision.svg)
- Lifecycle model: [docs/img/assembler-lifecycle.svg](./docs/img/assembler-lifecycle.svg)

---

## Providers at a glance

| Adapter                                 | Provider / API                                                                                                                    |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `openaiChatAdapter()`                   | OpenAI Chat Completions                                                                                                           |
| `openaiCompatibleAdapter({ provider })` | Groq, DeepSeek, Mistral, Ollama, LM Studio, Together, Fireworks, OpenRouter, Perplexity, xAI, Azure OpenAI, Cloudflare Workers AI |
| `anthropicAdapter()`                    | Anthropic Messages                                                                                                                |
| `openaiResponsesAdapter()`              | OpenAI Responses API                                                                                                              |
| `geminiAdapter()`                       | Google AI Gemini + Vertex AI (`apiSurface`)                                                                                       |
| `bedrockAdapter()`                      | AWS Bedrock Converse / ConverseStream                                                                                             |
| `cohereAdapter()`                       | Cohere Chat v2 (`api.cohere.com/v2/chat`)                                                                                         |

Feature flags and quirks: [docs/compatibility.md](./docs/compatibility.md).

---

## Documentation

- [Usage guides](./docs/usage-guides.md)
- [Provider compatibility matrix](./docs/compatibility.md)
- [Integration cookbook](./docs/integration-cookbook.md)
- [Examples index](./examples/README.md)
- [Adapter author guide](./docs/adapter-guide.md)
- [Performance & runtime behavior](./docs/performance.md)
- [How this compares](./docs/comparison.md)
- [FAQ](./docs/faq.md)
- [Architecture diagrams](./docs/img/README.md)

---

## Usage guides

Moved out of README to keep this page focused and release-stable:

- Core usage + adapter contract: [docs/usage-guides.md#core-usage](./docs/usage-guides.md#core-usage)
- OpenAI Chat / compatible / Azure / Cloudflare: [docs/usage-guides.md#openai-chat-usage](./docs/usage-guides.md#openai-chat-usage)
- Anthropic + OpenAI Responses: [docs/usage-guides.md#anthropic-messages-usage](./docs/usage-guides.md#anthropic-messages-usage)
- Gemini + Vertex: [docs/usage-guides.md#gemini-usage](./docs/usage-guides.md#gemini-usage)
- Bedrock + Cohere: [docs/usage-guides.md#bedrock-usage](./docs/usage-guides.md#bedrock-usage)

More operational guidance:

- Compatibility details: [docs/compatibility.md](./docs/compatibility.md)
- Framework recipes: [docs/integration-cookbook.md](./docs/integration-cookbook.md)
- Runnable examples: [examples/README.md](./examples/README.md)

---

## Examples

Runnable samples: [examples/README.md](./examples/README.md) — `examples/node-fetch/openai-chat.ts`, `examples/node-fetch/openai-compatible.ts`, `examples/node-fetch/azure-openai.ts`, `examples/node-fetch/perplexity.ts`, `examples/node-fetch/xai.ts`, `examples/node-fetch/gemini.ts`, `examples/node-fetch/vertex-gemini.ts`, `examples/node-fetch/bedrock.ts`, `examples/node-fetch/cohere.ts`, `examples/workers-ai/rest-chat-completions.ts`; proxy safety via `sanitizeErrors`.

- Full examples index: [examples/README.md](./examples/README.md)
- Node fetch examples: [examples/node-fetch/](./examples/node-fetch/)
- Integration recipes: [examples/integrations/](./examples/integrations/)
- Proxy safety patterns: [examples/proxy-safety/](./examples/proxy-safety/)

---

## Non-goals

- No HTTP client, auth, retries, or provider SDK wrapper.
- No agent loop, tool execution, memory, or persistence.
- No UI framework, React hooks, or browser components.
- No markdown/XML tag parsing inside model text.

---

## Development

```bash
pnpm install
pnpm verify
```

| Command               | Description                                         |
| --------------------- | --------------------------------------------------- |
| `pnpm verify`         | lint + typecheck + test + build                     |
| `pnpm verify:deps`    | fail if runtime dependencies are added              |
| `pnpm release:prep`   | pre-tag checks (version, CHANGELOG, dist, npm pack) |
| `pnpm diagrams:build` | regenerate README SVGs from Mermaid sources         |
| `pnpm test`           | Vitest smoke tests                                  |
| `pnpm build`          | tsup → ESM + CJS + declarations                     |

---

## Author

**Ladislav Kostolny** — [01laky@gmail.com](mailto:01laky@gmail.com) · [GitHub @01laky](https://github.com/01laky)

## License

MIT — see [LICENSE](./LICENSE). Copyright (c) 2026 Ladislav Kostolny.
