# llm-stream-assemble

*The missing stream assembly layer between LLM providers and your app.*

A small npm library (in development) that normalizes LLM streaming responses — text, tool calls, reasoning — into unified events.

**Status:** Phase 0 — scaffold (`0.0.3`). Public API is typed and exported; functions throw `not implemented` until v0.1. **Do not use in production yet.**

## Requirements

- Node.js 18+

## Documentation

- [Product & technical proposal](./docs/proposal.md)
- [Provider compatibility matrix](./docs/compatibility.md)
- [Adapter author guide](./docs/adapter-guide.md)

## Development

```bash
pnpm install
pnpm verify
```

Scripts:

| Command | Description |
| ------- | ----------- |
| `pnpm verify` | lint + typecheck + test + build |
| `pnpm verify:deps` | fail if runtime dependencies are added |
| `pnpm test` | Vitest smoke tests |
| `pnpm build` | tsup → ESM + CJS + declarations |

## Local prompts

Implementation prompts live in `prompts/` on your machine only — that directory is gitignored. The canonical spec is [`docs/proposal.md`](./docs/proposal.md).

## License

MIT — see [LICENSE](./LICENSE).
