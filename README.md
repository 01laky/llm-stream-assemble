# llm-stream-assemble

![core](https://img.shields.io/badge/core-1.3.1-blue)
![node](https://img.shields.io/badge/node-%3E%3D18-339933)
![runtime deps](https://img.shields.io/badge/runtime_deps-0-brightgreen)
![tests](https://img.shields.io/badge/tests-828%2B_passing-brightgreen)
[![ci](https://github.com/01laky/llm-stream-assemble/actions/workflows/ci.yml/badge.svg)](https://github.com/01laky/llm-stream-assemble/actions/workflows/ci.yml)
![status](https://img.shields.io/badge/status-stable_1.3.1-brightgreen)

**One typed event model for every LLM stream** — text, tool calls, reasoning, JSON, usage, refusals, errors, and non-streaming responses.

> A zero-dependency TypeScript layer for assembling **OpenAI**, **Anthropic**, **Google Gemini**, and **OpenAI-compatible** LLM streams into unified events — so you can stop hand-rolling provider parsers and keep one clean, typed event model across chat UIs, agents, proxies, and backends.

**Status:** Stable `1.3.1`. Five built-in adapters, thirteen OpenAI-compatible host presets (including **Azure OpenAI** and **Cloudflare Workers AI**), transforms, replay helpers, and examples are production-ready. Pin semver ranges as usual and review [CHANGELOG.md](./CHANGELOG.md) before major upgrades.

---

## Contents

- [Why use this](#why-use-this)
- [Architecture](#architecture)
- [Providers at a glance](#providers-at-a-glance)
- [Install](#install)
- [Quickstart](#quickstart)
- [Documentation](#documentation)
- [Usage guides](#usage-guides)
- [Transforms & replay](#transforms--replay)
- [Examples & proxy safety](#examples--proxy-safety)
- [Non-goals](#non-goals)
- [Development](#development)

---

## Why use this

- **Zero runtime dependencies** — thin adapters + core assembly, no provider SDKs.
- **Stream and non-stream parity** — same `StreamEvent` union from SSE chunks or JSON bodies.
- **Provider presets, not forks** — Groq, Azure, Cloudflare, Perplexity, xAI, and others reuse one compatible parser with dialect options.
- **Proxy-ready transforms** — `toSSE({ sanitizeErrors: true })`, `tapEvents`, `collectStream`, fixture replay.

---

## Architecture

Raw provider bytes enter through a **thin adapter**, get assembled into **typed events**, and leave through the same transform layer whether you stream live, replay fixtures, or proxy to a browser.

![End-to-end pipeline](https://raw.githubusercontent.com/01laky/llm-stream-assemble/main/docs/img/pipeline.svg)

### Built-in adapters

![Built-in adapters and compatible presets](https://raw.githubusercontent.com/01laky/llm-stream-assemble/main/docs/img/adapters-overview.svg)

### Unified event model

Every adapter maps provider-specific fragments into the same **`StreamEvent`** union:

![StreamEvent mindmap](https://raw.githubusercontent.com/01laky/llm-stream-assemble/main/docs/img/stream-event.svg)

**Design constraints:** adapters never accumulate cross-chunk state beyond id/index reconciliation; assembly, buffering, and `.done` emission live in core. No HTTP client, no tool execution, no UI — just the stream layer.

Diagram sources: [`docs/img/`](./docs/img/) (Mermaid `.mmd` + committed SVG). Regenerate with `pnpm diagrams:build`.

---

## Providers at a glance

| Adapter                                 | Provider / API                                                                                                                                     | Import                                      |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `openaiChatAdapter()`                   | OpenAI Chat Completions                                                                                                                            | `llm-stream-assemble`                       |
| `openaiCompatibleAdapter({ provider })` | Groq, DeepSeek, Mistral, Ollama, LM Studio, Together, Fireworks, OpenRouter, Perplexity, xAI, **Azure OpenAI**, **Cloudflare Workers AI**, generic | `llm-stream-assemble`                       |
| `anthropicAdapter()`                    | Anthropic Messages                                                                                                                                 | `llm-stream-assemble`                       |
| `openaiResponsesAdapter()`              | OpenAI Responses API                                                                                                                               | `llm-stream-assemble`                       |
| `geminiAdapter()`                       | Google AI Gemini                                                                                                                                   | `llm-stream-assemble` or `/adapters/gemini` |

Full feature flags and quirks: [compatibility matrix](./docs/compatibility.md).

---

## Install

```bash
pnpm add llm-stream-assemble
# or npm install llm-stream-assemble
```

**Requirements:** Node.js 18+

---

## Quickstart

```ts
import { assembleStream, openaiChatAdapter } from "llm-stream-assemble";

for await (const event of assembleStream(response.body!, openaiChatAdapter())) {
	if (event.type === "text.delta") process.stdout.write(event.text);
}
```

---

## Documentation

- [Provider compatibility matrix](./docs/compatibility.md)
- [Adapter author guide](./docs/adapter-guide.md)
- [Architecture diagrams](./docs/img/README.md)
- [Live smoke checklist (maintainers)](./docs/live-smoke.md)
- [Post-1.0 provider roadmap](./docs/post-1.0-provider-roadmap.md)
- [Product & technical proposal](./docs/proposal.md)

---

## Usage guides

### Core Usage

The core pipeline works with any adapter that emits `RawChunk[]`, including the built-in OpenAI Chat, OpenAI-compatible, Anthropic Messages, OpenAI Responses, and Google Gemini adapters:

```ts
import { assembleFromPayloads, type StreamAdapter } from "llm-stream-assemble";

const adapter: StreamAdapter = {
	parseChunk(raw) {
		const data = JSON.parse(raw) as { text?: string };
		return data.text ? [{ kind: "text-delta", text: data.text }] : [];
	},
};

for await (const event of assembleFromPayloads(payloads, adapter)) {
	if (event.type === "text.delta") process.stdout.write(event.text);
}
```

Assembly buffers completed text, reasoning, JSON, and tool-call arguments so it can emit final `.done` events. Use `maxBufferBytes` to cap those buffers for untrusted or unusually large streams.

### OpenAI Chat Usage

`openaiChatAdapter()` parses OpenAI Chat Completions payloads. Create one adapter instance per request/stream because it keeps minimal state for metadata and tool-call indexes.

```ts
import { assembleStream, openaiChatAdapter } from "llm-stream-assemble";

const response = await fetch("https://api.openai.com/v1/chat/completions", {
	method: "POST",
	headers: {
		Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
		"Content-Type": "application/json",
	},
	body: JSON.stringify({
		model: "gpt-4o-mini",
		messages,
		stream: true,
		stream_options: { include_usage: true },
	}),
});

for await (const event of assembleStream(response.body!, openaiChatAdapter())) {
	if (event.type === "text.delta") process.stdout.write(event.text);
}
```

Streaming usage requires `stream_options: { include_usage: true }` on the OpenAI request. JSON mode content is exposed by OpenAI as normal content deltas, so use `openaiChatAdapter({ jsonMode: true })` when you want content mapped to `json.*` events.

### OpenAI-Compatible Usage

`openaiCompatibleAdapter()` supports OpenAI-shaped Chat Completions APIs with best-effort provider presets. Create one adapter instance per request/stream.

```ts
import { assembleStream, openaiCompatibleAdapter } from "llm-stream-assemble";

const adapter = openaiCompatibleAdapter({
	provider: "openrouter",
});

for await (const event of assembleStream(response.body!, adapter)) {
	if (event.type === "text.delta") process.stdout.write(event.text);
}
```

Provider presets:

| Preset       | Intended hosts                | Notes                                                                                       |
| ------------ | ----------------------------- | ------------------------------------------------------------------------------------------- |
| `generic`    | Any OpenAI-shaped API         | Loose defaults, best first try                                                              |
| `openrouter` | OpenRouter                    | Mostly OpenAI-shaped; provider-specific metadata may appear                                 |
| `groq`       | Groq OpenAI-compatible API    | OpenAI-like; usage can vary by endpoint/model                                               |
| `deepseek`   | DeepSeek API                  | Maps `reasoning_content` to reasoning events on R1-style models                             |
| `mistral`    | Mistral API                   | OpenAI-like; parallel tool calls supported                                                  |
| `ollama`     | Ollama `/v1/chat/completions` | Local host, metadata may be sparse                                                          |
| `lmstudio`   | LM Studio local server        | Local host, metadata/usage may be sparse                                                    |
| `together`   | Together AI                   | OpenAI-like; `reasoning` / `reasoning_delta` aliases                                        |
| `fireworks`  | Fireworks AI                  | OpenAI-like, usage/details may vary                                                         |
| `perplexity` | Perplexity API                | Search-grounded answers; citations in `metadata.raw`                                        |
| `xai`        | xAI Grok API                  | OpenAI-compatible; `reasoning_content` mapped when present                                  |
| `azure`      | Azure OpenAI Chat Completions | Stricter preset; deployment URL + `api-key` auth; content filter metadata in `metadata.raw` |
| `cloudflare` | Cloudflare Workers AI REST    | OpenAI-compatible `/v1/chat/completions`; Bearer + account id; loose preset like Groq       |

Base URL examples: Groq `https://api.groq.com/openai/v1`, DeepSeek `https://api.deepseek.com`, Mistral `https://api.mistral.ai/v1`, Ollama `http://localhost:11434/v1`, LM Studio `http://localhost:1234/v1`, Together `https://api.together.xyz/v1`, Fireworks `https://api.fireworks.ai/inference/v1`, OpenRouter `https://openrouter.ai/api/v1`, Perplexity `https://api.perplexity.ai`, xAI `https://api.x.ai/v1`, Azure OpenAI `https://{resource}.openai.azure.com/openai/deployments/{deployment}/chat/completions?api-version={version}`, Cloudflare Workers AI `https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1/chat/completions`.

Strict vs loose configuration:

```ts
// Loose default: good for local/open-source OpenAI-compatible hosts.
openaiCompatibleAdapter({ provider: "ollama" });

// Stricter mode: useful when unexpected payload shapes should fail fast.
openaiCompatibleAdapter({
	provider: "generic",
	allowMissingMetadata: false,
	looseErrorShape: false,
	useChoicePositionFallback: false,
});
```

Known limitations:

- Provider presets are fixture-tested and best-effort; CI does not call live provider APIs.
- Hosts can change OpenAI-compatible dialects without notice.
- Non-string reasoning payloads are skipped.
- Multi-choice terminal behavior is limited by the current core single terminal finish event.
- Missing tool ids are tolerated because core can synthesize stable ids by index.

### Azure OpenAI Usage

Azure OpenAI Chat Completions uses a deployment-scoped URL and **`api-key`** authentication instead of Bearer tokens. Use the **`azure`** preset — not `generic` — for stricter parsing aligned with OpenAI Chat semantics (`allowMissingMetadata: false`, `looseErrorShape: false`).

```ts
import { assembleStream, openaiCompatibleAdapter } from "llm-stream-assemble";

const resource = process.env.AZURE_OPENAI_RESOURCE!;
const deployment = process.env.AZURE_OPENAI_DEPLOYMENT!;
const apiVersion = process.env.AZURE_OPENAI_API_VERSION ?? "2024-10-21";
const url = `https://${resource}.openai.azure.com/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;

const response = await fetch(url, {
	method: "POST",
	headers: {
		"api-key": process.env.AZURE_OPENAI_API_KEY!,
		"Content-Type": "application/json",
	},
	body: JSON.stringify({
		messages: [{ role: "user", content: "Hello" }],
		stream: true,
		stream_options: { include_usage: true },
	}),
});

for await (const event of assembleStream(
	response.body!,
	openaiCompatibleAdapter({ provider: "azure" }),
)) {
	if (event.type === "text.delta") process.stdout.write(event.text);
}
```

Use `openaiCompatibleAdapter({ provider: "azure", jsonMode: true })` when structured JSON output should map to `json.*` events. Content-filter blocks surface as `refusal.*` events with `finish_reason: content_filter`; filter result fields remain in `metadata.raw` for auditing. If an API gateway strips metadata from chunks, soften strict parsing server-side only with `allowMissingMetadata: true`.

See `examples/node-fetch/azure-openai.ts` for a URL builder helper and `examples/proxy-safety/README.md` for server-side proxy notes.

### Cloudflare Workers AI Usage

Cloudflare Workers AI exposes an OpenAI-compatible REST endpoint at `/v1/chat/completions` under your account. Use the **`cloudflare`** preset — not `generic` — when you want fixture-tested defaults for Workers AI REST (loose metadata tolerance like Groq).

```ts
import { assembleStream, openaiCompatibleAdapter } from "llm-stream-assemble";

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID!;
const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/chat/completions`;

const response = await fetch(url, {
	method: "POST",
	headers: {
		Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN!}`,
		"Content-Type": "application/json",
	},
	body: JSON.stringify({
		model: "@cf/meta/llama-3.1-8b-instruct",
		messages: [{ role: "user", content: "Hello" }],
		stream: true,
		stream_options: { include_usage: true },
	}),
});

for await (const event of assembleStream(
	response.body!,
	openaiCompatibleAdapter({ provider: "cloudflare" }),
)) {
	if (event.type === "text.delta") process.stdout.write(event.text);
}
```

Streaming usage requires `stream_options: { include_usage: true }` on the request. Use `openaiCompatibleAdapter({ provider: "cloudflare", jsonMode: true })` when JSON output should map to `json.*` events.

The **`env.AI.run(model, { stream: true })`** Worker binding can return SSE bytes compatible with `assembleStream` when the model streams Chat Completions-shaped payloads — account binding and auth stay in your Worker; this library only parses the bytes.

See `examples/workers-ai/rest-chat-completions.ts` and `examples/proxy-safety/README.md` (Bearer token + account id must never reach the browser).

### Anthropic Messages Usage

`anthropicAdapter()` parses Anthropic Messages streaming events and non-streaming responses. Create one adapter instance per request/stream.

```ts
import { anthropicAdapter, assembleStream } from "llm-stream-assemble";

for await (const event of assembleStream(response.body!, anthropicAdapter())) {
	if (event.type === "text.delta") process.stdout.write(event.text);
}
```

Anthropic tool calls are emitted from `tool_use` content blocks. Fine-grained tool input streaming is supported through `input_json_delta`; partial input may be invalid JSON until the block ends, and core handles those partial previews best-effort. Thinking blocks map to `reasoning.*` events with `variant: "detail"`.

### OpenAI Responses Usage

`openaiResponsesAdapter()` parses OpenAI Responses API streaming events and non-streaming response objects. It focuses on output text and function call argument streams; Realtime, audio, and multimodal binary output are out of scope.

```ts
import { assembleStream, openaiResponsesAdapter } from "llm-stream-assemble";

for await (const event of assembleStream(response.body!, openaiResponsesAdapter())) {
	if (event.type === "tool_call.args.delta") console.log(event.delta);
}
```

Use `openaiResponsesAdapter({ jsonMode: true })` to map output text to `json.*` events. Reasoning support is best-effort for string summary/detail fields. Create a new adapter instance per stream.

### Gemini Usage

`geminiAdapter()` parses Google AI Gemini `GenerateContentResponse` payloads from `streamGenerateContent?alt=sse` and non-streaming `generateContent`. Create one adapter instance per request/stream.

```ts
import { assembleStream, geminiAdapter } from "llm-stream-assemble";

const model = "gemini-2.5-flash";
const apiKey = process.env.GOOGLE_API_KEY!;
const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;

const response = await fetch(url, {
	method: "POST",
	headers: { "Content-Type": "application/json" },
	body: JSON.stringify({
		contents: [{ role: "user", parts: [{ text: "Hello" }] }],
	}),
});

for await (const event of assembleStream(response.body!, geminiAdapter())) {
	if (event.type === "text.delta") process.stdout.write(event.text);
	if (event.type === "tool_call.done") console.log(event.name, event.args);
}
```

Use `geminiAdapter({ jsonMode: true })` when structured JSON output should map to `json.*` instead of `text.*`. Thinking models may emit `thought` parts mapped to `reasoning.*` (best-effort). Gemini does not expose OpenAI-style `refusal.*` events — blocked prompts use `promptFeedback` or safety finish reasons instead.

Subpath import: `import { geminiAdapter } from "llm-stream-assemble/adapters/gemini"`.

Vertex AI and the Interactions API are out of scope for this adapter; see [compatibility matrix](./docs/compatibility.md).

---

## Transforms & replay

![Transforms and helpers](https://raw.githubusercontent.com/01laky/llm-stream-assemble/main/docs/img/transforms.svg)

### Collecting a Stream

`collectStream()` materializes a full event stream into text, reasoning, refusals, JSON, tool calls, latest usage, and finish reason. It buffers full output in memory and aggregates multi-choice text in event order; it is not a per-choice collector and does not currently collect metadata.

```ts
import { collectStream } from "llm-stream-assemble";

const result = await collectStream(events);
console.log(result.text, result.toolCalls, result.finishReason);
```

### Tapping Events

`tapEvents()` lets you observe events for logging or metrics without changing the stream.

```ts
import { tapEvents } from "llm-stream-assemble";

for await (const event of tapEvents(events, (event) => console.debug(event.type))) {
	// consume normally
}
```

### Forwarding Unified SSE

`toSSE()` serializes unified `StreamEvent` objects as `data: <json>` SSE messages. It does not currently emit named SSE `event:` fields, and it emits unified event JSON rather than raw provider SSE.

```ts
import { toSSE } from "llm-stream-assemble";

return new Response(toSSE(events, { sanitizeErrors: true }), {
	headers: { "Content-Type": "text/event-stream" },
});
```

Use `sanitizeErrors: true` when forwarding events to browsers so raw provider internals are not exposed.

### Replaying Fixtures

`assembleFromFile()` is a Node/dev replay helper for local `.sse` and `.json` fixtures. It uses `node:fs/promises`, so avoid it in browser bundles; a dedicated browser/edge entry point can be added later if needed.

```ts
import { assembleFromFile, openaiChatAdapter } from "llm-stream-assemble";

for await (const event of assembleFromFile(
	"test/fixtures/openai-chat/text-basic.sse",
	openaiChatAdapter(),
)) {
	console.log(event);
}
```

---

## Examples & proxy safety

| Example                                                                                          | Description                                      |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| [`examples/node-fetch/openai-chat.ts`](./examples/node-fetch/openai-chat.ts)                     | OpenAI Chat Completions streaming                |
| [`examples/node-fetch/openai-compatible.ts`](./examples/node-fetch/openai-compatible.ts)         | OpenAI-compatible presets                        |
| [`examples/node-fetch/azure-openai.ts`](./examples/node-fetch/azure-openai.ts)                   | Azure OpenAI deployment URL + `api-key`          |
| [`examples/workers-ai/rest-chat-completions.ts`](./examples/workers-ai/rest-chat-completions.ts) | Cloudflare Workers AI REST + `cloudflare` preset |
| [`examples/node-fetch/perplexity.ts`](./examples/node-fetch/perplexity.ts)                       | Perplexity streaming                             |
| [`examples/node-fetch/xai.ts`](./examples/node-fetch/xai.ts)                                     | xAI Grok streaming                               |
| [`examples/node-fetch/anthropic.ts`](./examples/node-fetch/anthropic.ts)                         | Anthropic Messages                               |
| [`examples/node-fetch/gemini.ts`](./examples/node-fetch/gemini.ts)                               | Google Gemini SSE                                |
| [`examples/node-fetch/replay-fixture.ts`](./examples/node-fetch/replay-fixture.ts)               | Local fixture replay                             |
| [`examples/proxy-safety/`](./examples/proxy-safety/)                                             | Proxy + browser client patterns                  |

Proxy safety:

- Use `toSSE(events, { sanitizeErrors: true })` for browser-facing streams.
- Use `tapEvents` for server-side observation and logging.
- Never forward raw provider errors or upstream non-OK response bodies to browsers.
- CORS headers are application-specific and intentionally omitted from the Web-standard example.

---

## Non-goals

- No HTTP client, auth, retries, or provider SDK wrapper.
- No agent loop, tool execution, memory, or persistence.
- No UI framework, React hooks, or browser components.
- No multimodal binary/audio/video parsing.

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
