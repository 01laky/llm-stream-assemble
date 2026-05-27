# Architecture diagrams

Mermaid sources and pre-rendered SVGs for the README and docs. npm README cannot execute
Mermaid — always commit updated **`.svg`** files alongside **`.mmd`** edits.

| File                      | Purpose                                                                                  |
| ------------------------- | ---------------------------------------------------------------------------------------- |
| `pipeline.mmd`            | End-to-end bytes → adapters → core → apps (incl. Bedrock decode boundary, Cohere v2 SSE) |
| `adapters-overview.mmd`   | Built-in adapters and compatible presets (`bedrockAdapter`, `cohereAdapter`)             |
| `stream-event.mmd`        | Unified `StreamEvent` union mindmap                                                      |
| `transforms.mmd`          | `collectStream`, `tapEvents`, `toSSE`, replay, `assembleFromPayloads`                    |
| `quick-decision.mmd`      | Adapter routing decision tree incl. Bedrock ConverseStream and Cohere v2                 |
| `assembler-lifecycle.mmd` | Stateful assembler vs stateless adapters (Bedrock jsonl path, Cohere SSE)                |
| `chunk-assembly.mmd`      | SSE + Bedrock EventStream decode → unified assembly (Cohere v2 on SSE path)              |

Regenerate after editing sources:

```bash
pnpm diagrams:build
```

Requires `@mermaid-js/mermaid-cli` (installed on demand via `pnpm diagrams:build`).
