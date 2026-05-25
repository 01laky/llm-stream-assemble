# llm-stream-assemble

![core](https://img.shields.io/badge/core-0.5.0-blue)
![node](https://img.shields.io/badge/node-%3E%3D18-339933)
![runtime deps](https://img.shields.io/badge/runtime_deps-0-brightgreen)
![tests](https://img.shields.io/badge/tests-330%2B_passing-brightgreen)
[![ci](https://github.com/01laky/llm-stream-assemble/actions/workflows/ci.yml/badge.svg)](https://github.com/01laky/llm-stream-assemble/actions/workflows/ci.yml)
![status](https://img.shields.io/badge/status-phase_5_transforms-orange)

A small npm library (in development) that normalizes LLM streaming responses — text, tool calls, reasoning — into unified events.

**Status:** Phase 5 — core, provider adapters, transforms, and replay helpers functional (`0.5.0`). SSE parsing, partial JSON, stream assembly, non-streaming assembly, TransformStream support, provider adapters, collection, tapping, unified SSE forwarding, and local fixture replay are implemented. Examples and publish prep are still planned, so **do not use in production yet**.

## Requirements

- Node.js 18+

## Documentation

- [Product & technical proposal](./docs/proposal.md)
- [Provider compatibility matrix](./docs/compatibility.md)
- [Adapter author guide](./docs/adapter-guide.md)

## Core Usage

Provider adapters are still stubs in this phase, but the core works with any adapter that emits `RawChunk[]`:

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

| Preset       | Intended hosts                | Notes                                                       |
| ------------ | ----------------------------- | ----------------------------------------------------------- |
| `generic`    | Any OpenAI-shaped API         | Loose defaults, best first try                              |
| `openrouter` | OpenRouter                    | Mostly OpenAI-shaped; provider-specific metadata may appear |
| `groq`       | Groq OpenAI-compatible API    | OpenAI-like; usage can vary by endpoint/model               |
| `ollama`     | Ollama `/v1/chat/completions` | Local host, metadata may be sparse                          |
| `lmstudio`   | LM Studio local server        | Local host, metadata/usage may be sparse                    |
| `together`   | Together AI                   | OpenAI-like, reasoning fields may vary                      |
| `fireworks`  | Fireworks AI                  | OpenAI-like, usage/details may vary                         |

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

## Anthropic Messages Usage

`anthropicAdapter()` parses Anthropic Messages streaming events and non-streaming responses. Create one adapter instance per request/stream.

```ts
import { anthropicAdapter, assembleStream } from "llm-stream-assemble";

for await (const event of assembleStream(response.body!, anthropicAdapter())) {
	if (event.type === "text.delta") process.stdout.write(event.text);
}
```

Anthropic tool calls are emitted from `tool_use` content blocks. Fine-grained tool input streaming is supported through `input_json_delta`; partial input may be invalid JSON until the block ends, and core handles those partial previews best-effort. Thinking blocks map to `reasoning.*` events with `variant: "detail"`.

## Collecting a Stream

`collectStream()` materializes a full event stream into text, reasoning, refusals, JSON, tool calls, latest usage, and finish reason. It buffers full output in memory and aggregates multi-choice text in event order; it is not a per-choice collector and does not collect metadata in Phase 5.

```ts
import { collectStream } from "llm-stream-assemble";

const result = await collectStream(events);
console.log(result.text, result.toolCalls, result.finishReason);
```

## Tapping Events

`tapEvents()` lets you observe events for logging or metrics without changing the stream.

```ts
import { tapEvents } from "llm-stream-assemble";

for await (const event of tapEvents(events, (event) => console.debug(event.type))) {
	// consume normally
}
```

## Forwarding Unified SSE

`toSSE()` serializes unified `StreamEvent` objects as `data: <json>` SSE messages. It does not emit named SSE `event:` fields in Phase 5, and it emits unified event JSON rather than raw provider SSE.

```ts
import { toSSE } from "llm-stream-assemble";

return new Response(toSSE(events, { sanitizeErrors: true }), {
	headers: { "Content-Type": "text/event-stream" },
});
```

Use `sanitizeErrors: true` when forwarding events to browsers so raw provider internals are not exposed.

## Replaying Fixtures

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

## Development

```bash
pnpm install
pnpm verify
```

Scripts:

| Command            | Description                            |
| ------------------ | -------------------------------------- |
| `pnpm verify`      | lint + typecheck + test + build        |
| `pnpm verify:deps` | fail if runtime dependencies are added |
| `pnpm test`        | Vitest smoke tests                     |
| `pnpm build`       | tsup → ESM + CJS + declarations        |

## Local prompts

Implementation prompts live in `prompts/` on your machine only — that directory is gitignored. The canonical spec is [`docs/proposal.md`](./docs/proposal.md).

## Author

**Ladislav Kostolny** — [01laky@gmail.com](mailto:01laky@gmail.com) · [GitHub @01laky](https://github.com/01laky)

## License

MIT — see [LICENSE](./LICENSE). Copyright (c) 2026 Ladislav Kostolny.
