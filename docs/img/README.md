# Architecture diagrams

Mermaid sources and pre-rendered SVGs for the README and docs. npm README cannot execute
Mermaid — always commit updated **`.svg`** files alongside **`.mmd`** edits.

| File                      | Purpose                                                                   |
| ------------------------- | ------------------------------------------------------------------------- |
| `pipeline.mmd`            | End-to-end bytes → adapters → core → apps (incl. Bedrock decode boundary) |
| `adapters-overview.mmd`   | Built-in adapters and compatible presets (`bedrockAdapter`)               |
| `stream-event.mmd`        | Unified `StreamEvent` union mindmap                                       |
| `transforms.mmd`          | `collectStream`, `tapEvents`, `toSSE`, replay, `assembleFromPayloads`     |
| `quick-decision.mmd`      | Adapter routing decision tree incl. Bedrock ConverseStream                |
| `assembler-lifecycle.mmd` | Stateful assembler vs stateless adapters (Bedrock jsonl path)             |
| `chunk-assembly.mmd`      | SSE + Bedrock EventStream decode → unified assembly                       |

Regenerate after editing sources:

```bash
pnpm diagrams:build
```

Requires `@mermaid-js/mermaid-cli` (installed on demand via `pnpm diagrams:build`).
