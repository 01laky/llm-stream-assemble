# llm-stream-assemble

![core](https://img.shields.io/badge/core-0.2.0-blue)
![node](https://img.shields.io/badge/node-%3E%3D18-339933)
![runtime deps](https://img.shields.io/badge/runtime_deps-0-brightgreen)
![tests](https://img.shields.io/badge/tests-210%2B_passing-brightgreen)
[![ci](https://github.com/01laky/llm-stream-assemble/actions/workflows/ci.yml/badge.svg)](https://github.com/01laky/llm-stream-assemble/actions/workflows/ci.yml)
![status](https://img.shields.io/badge/status-phase_2_openai_chat-orange)

A small npm library (in development) that normalizes LLM streaming responses — text, tool calls, reasoning — into unified events.

**Status:** Phase 2 — core + OpenAI Chat adapter functional (`0.2.0`). SSE parsing, partial JSON, stream assembly, non-streaming assembly, TransformStream support, and OpenAI Chat Completions parsing are implemented. OpenAI-compatible, Anthropic, and convenience transforms are still planned, so **do not use in production yet**.

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
