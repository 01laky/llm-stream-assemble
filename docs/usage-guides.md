# Usage guides

**Status:** Active guide — `1.10.1`

Provider-specific and core usage patterns moved from the README. This page keeps full examples and notes for each built-in adapter.

---

## First success in 30 seconds

```ts
import { assembleStream, openaiChatAdapter } from "llm-stream-assemble";

for await (const event of assembleStream(response.body!, openaiChatAdapter())) {
	if (event.type === "text.delta") process.stdout.write(event.text);
}
```

## Why not `text += chunk`?

Provider streams are protocol events, not finished strings — see [edge-cases.md](./edge-cases.md).

## Performance at a glance

- **Zero runtime dependencies**
- Streaming assembly is **O(n)** over event count (**LSA-C52**)

## StreamEvent highlights

Typed **`citation`**, **`grounding`**, and **`logprob`** events ship alongside text, tools, reasoning, JSON, and lifecycle events (citations and grounding for RAG-style providers). Event shape diagram: [stream-event.svg](./img/stream-event.svg).

## Transforms and replay helpers

### Collecting a Stream

**`collectStream`** aggregates a stream into text, tools, and usage — materializes full output in memory.

### Tapping Events

**`tapEvents`** wraps an event iterator for logging or metrics without changing the stream.

### Converting back to SSE

**`toSSE`** re-encodes events for browser clients; use **`sanitizeErrors: true`** when proxying.

### Node/dev replay helper

**`assembleFromFile`** replays checked-in fixtures from disk during development.

**Browser/edge bundling:** prefer ESM subpath exports for browser bundles; **`assembleFromFile`** uses `node:fs/promises` and is Node-only.

---

`assembleStream`, `assembleFromPayloads`, `assembleResponse`, and `createAssemblyTransform` share the same `StreamEvent` union.

---

## Core Usage

The core pipeline works with any adapter that emits `RawChunk[]`, including the built-in OpenAI Chat, OpenAI-compatible, Anthropic Messages, OpenAI Responses, Google Gemini, AWS Bedrock, and Cohere adapters:

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

## OpenAI Chat Usage

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

## OpenAI-Compatible Usage

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
| `perplexity` | Perplexity API                | Search-grounded answers; root `citations` / `search_results` → typed `citation` events      |
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

## Azure OpenAI Usage

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

## Cloudflare Workers AI Usage

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

## Anthropic Messages Usage

`anthropicAdapter()` parses Anthropic Messages streaming events and non-streaming responses. Create one adapter instance per request/stream.

```ts
import { anthropicAdapter, assembleStream } from "llm-stream-assemble";

for await (const event of assembleStream(response.body!, anthropicAdapter())) {
	if (event.type === "text.delta") process.stdout.write(event.text);
}
```

Anthropic tool calls are emitted from `tool_use` content blocks. Fine-grained tool input streaming is supported through `input_json_delta`; partial input may be invalid JSON until the block ends, and core handles those partial previews best-effort. Thinking blocks map to `reasoning.*` events with `variant: "detail"`.

## OpenAI Responses Usage

`openaiResponsesAdapter()` parses OpenAI Responses API streaming events and non-streaming response objects. It focuses on output text and function call argument streams; Realtime, audio, and multimodal binary output are out of scope.

```ts
import { assembleStream, openaiResponsesAdapter } from "llm-stream-assemble";

for await (const event of assembleStream(response.body!, openaiResponsesAdapter())) {
	if (event.type === "tool_call.args.delta") console.log(event.delta);
}
```

Use `openaiResponsesAdapter({ jsonMode: true })` to map output text to `json.*` events. Reasoning support is best-effort for string summary/detail fields. Typed **`logprob`** events when the request sets `include: ["message.output_text.logprobs"]` (optional `top_logprobs`) — same helpers as Chat Completions. Create a new adapter instance per stream.

## Gemini Usage

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

### Vertex AI Gemini

Vertex uses the same `geminiAdapter()` with **`apiSurface: "vertex"`**. The adapter strips Vertex / gateway envelopes (`response`, `result`, `predictions[0]`) via **`normalizeVertexChunk()`** before mapping `candidates` and tools. Vertex HTTP streams are often **JSONL or concatenated JSON objects**, not Google AI `data:` SSE — split complete JSON strings in your app, then pass each line to `assembleFromPayloads` (see [`examples/vertex/read-chunk-stream.ts`](../examples/vertex/read-chunk-stream.ts)).

```ts
import { assembleFromPayloads, geminiAdapter } from "llm-stream-assemble";
import { buildVertexStreamUrl } from "../examples/vertex/build-vertex-url";
import { readVertexJsonlStrings } from "../examples/vertex/read-chunk-stream";

const projectId = process.env.GOOGLE_CLOUD_PROJECT!;
const location = process.env.VERTEX_LOCATION ?? "us-central1";
const model = process.env.VERTEX_MODEL ?? "gemini-2.5-flash";
const accessToken = process.env.VERTEX_ACCESS_TOKEN!; // ADC — not GOOGLE_API_KEY

const response = await fetch(buildVertexStreamUrl({ projectId, location, model }), {
	method: "POST",
	headers: {
		Authorization: `Bearer ${accessToken}`,
		"Content-Type": "application/json",
	},
	body: JSON.stringify({
		contents: [{ role: "user", parts: [{ text: "Hello" }] }],
	}),
});

async function* lines() {
	for await (const line of readVertexJsonlStrings(response.body!)) yield line;
}

for await (const event of assembleFromPayloads(lines(), geminiAdapter({ apiSurface: "vertex" }))) {
	if (event.type === "text.delta") process.stdout.write(event.text);
}
```

Obtain a short-lived bearer token with Application Default Credentials, e.g. `gcloud auth application-default print-access-token`, and set `VERTEX_ACCESS_TOKEN` (or pass `accessToken` in your own wrapper). Full runnable example: [`examples/node-fetch/vertex-gemini.ts`](../examples/node-fetch/vertex-gemini.ts). Live smoke: `pnpm smoke:vertex` — see [live-smoke](./live-smoke.md).

The Gemini **Interactions API** remains deferred; see [compatibility matrix](./compatibility.md).

## Bedrock Usage

`bedrockAdapter()` parses **decoded** AWS Bedrock **ConverseStream** JSON events — one ConverseStream envelope object per `parseChunk` call. Create one adapter instance per request/stream.

Bedrock streaming responses are often `application/vnd.amazon.eventstream` (binary). **Decode EventStream bytes in your app, AWS SDK, or the example helper** before assembly — this library does not sign requests or parse binary framing.

```
Bedrock Runtime → EventStream bytes → [SDK or decode helper] → JSON strings
  → bedrockAdapter().parseChunk / assembleFromPayloads / assembleStream → StreamEvent[]
```

**Recommended path:** use `@aws-sdk/client-bedrock-runtime` `ConverseStreamCommand`, iterate the async stream, `JSON.stringify` each event object, and feed lines to `assembleFromPayloads`. See [`examples/bedrock/README.md`](../examples/bedrock/README.md) and [`examples/node-fetch/bedrock.ts`](../examples/node-fetch/bedrock.ts).

```ts
import { assembleFromPayloads, bedrockAdapter } from "llm-stream-assemble";

async function* decodedConverseEvents(sdkStream: AsyncIterable<Record<string, unknown>>) {
	for await (const event of sdkStream) {
		yield JSON.stringify(event);
	}
}

for await (const event of assembleFromPayloads(
	decodedConverseEvents(converseStream),
	bedrockAdapter({ modelFamily: "auto" }),
)) {
	if (event.type === "text.delta") process.stdout.write(event.text);
	if (event.type === "tool_call.done") console.log(event.name, event.args);
}
```

**`modelFamily`** hints which ConverseStream dialect to prefer when envelopes overlap:

| Value           | When to use                                                       |
| --------------- | ----------------------------------------------------------------- |
| `"auto"`        | Default — structural detection from payload shape                 |
| `"anthropic"`   | Claude on Bedrock — reasoning deltas, Anthropic-style tool blocks |
| `"nova"`        | Amazon Nova models                                                |
| `"openai-like"` | Llama and other OpenAI-shaped delta fields                        |

Use `bedrockAdapter({ jsonMode: true })` when structured JSON text blocks should map to `json.*` instead of `text.*`. Guardrail interventions map to `finish` with `content_filter`; trace details remain in `metadata.raw`.

**Environment variables** for live smoke and examples: `AWS_REGION`, `BEDROCK_MODEL_ID`, plus standard AWS credential chain (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_PROFILE`, SSO). IAM and SigV4 signing stay outside this library.

Subpath import: `import { bedrockAdapter } from "llm-stream-assemble/adapters/bedrock"`.

Worker proxy recipe: [`examples/integrations/bedrock-worker-proxy.ts`](../examples/integrations/bedrock-worker-proxy.ts). EventStream decode helper (examples only): [`examples/bedrock/decode-event-stream.ts`](../examples/bedrock/decode-event-stream.ts).

## Cohere Usage

`cohereAdapter()` parses Cohere Chat **v2** SSE events from `https://api.cohere.com/v2/chat` and non-streaming v2 response bodies. Create one adapter instance per request/stream. Cohere is **not** OpenAI-compatible — use `cohereAdapter()`, not `openaiCompatibleAdapter()`.

Core `parseSSE()` frames the HTTP body; `assembleStream` yields one JSON payload string per `data:` line to `cohereAdapter().parseChunk`.

```ts
import { assembleStream, cohereAdapter } from "llm-stream-assemble";

const response = await fetch("https://api.cohere.com/v2/chat", {
	method: "POST",
	headers: {
		Authorization: `Bearer ${process.env.COHERE_API_KEY}`,
		"Content-Type": "application/json",
	},
	body: JSON.stringify({
		model: "command-r-plus-08-2024",
		messages: [{ role: "user", content: "Hello" }],
		stream: true,
	}),
});

for await (const event of assembleStream(response.body!, cohereAdapter())) {
	if (event.type === "text.delta") process.stdout.write(event.text);
	if (event.type === "reasoning.delta") process.stdout.write(event.text);
	if (event.type === "tool_call.done") console.log(event.name, event.args);
}
```

Use `cohereAdapter({ jsonMode: true })` when structured JSON output should map to `json.*` instead of `text.*`. **`tool-plan-delta`** events map to `reasoning.*` with `variant: "detail"`. **`citation-start`** maps to typed **`citation`** events (span, sources, index). Set `emitLegacyCitationMetadata: true` on any citation-capable adapter to dual-emit legacy `metadata.raw` blobs during migration. Legacy Cohere v1 endpoints are out of scope.

Subpath import: `import { cohereAdapter } from "llm-stream-assemble/adapters/cohere"`.

Live smoke: `pnpm smoke:cohere` — see [`live-smoke.md`](./live-smoke.md) for `COHERE_API_KEY`, `COHERE_MODEL`, and `COHERE_SMOKE_TOOLS`.
