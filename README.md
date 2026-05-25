# llm-stream-assemble

![core](https://img.shields.io/badge/core-0.1.0-blue)
![node](https://img.shields.io/badge/node-%3E%3D18-339933)
![runtime deps](https://img.shields.io/badge/runtime_deps-0-brightgreen)
![tests](https://img.shields.io/badge/tests-160%2B_passing-brightgreen)
[![ci](https://github.com/01laky/llm-stream-assemble/actions/workflows/ci.yml/badge.svg)](https://github.com/01laky/llm-stream-assemble/actions/workflows/ci.yml)
![status](https://img.shields.io/badge/status-phase_1_core-orange)

A small npm library (in development) that normalizes LLM streaming responses — text, tool calls, reasoning — into unified events.

**Status:** Phase 1 — core functional (`0.1.0`). SSE parsing, partial JSON, stream assembly, non-streaming assembly, and TransformStream support are implemented. Provider adapters and convenience transforms are still planned, so **do not use in production yet**.

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
