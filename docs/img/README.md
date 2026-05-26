# Architecture diagrams

Mermaid sources and pre-rendered SVGs for the README and docs. npm README cannot execute
Mermaid — always commit updated **`.svg`** files alongside **`.mmd`** edits.

| File                    | Purpose                                       |
| ----------------------- | --------------------------------------------- |
| `pipeline.mmd`          | End-to-end bytes → adapters → core → apps     |
| `adapters-overview.mmd` | Built-in adapters and compatible presets      |
| `stream-event.mmd`      | Unified `StreamEvent` union mindmap           |
| `transforms.mmd`        | `collectStream`, `tapEvents`, `toSSE`, replay |

Regenerate after editing sources:

```bash
pnpm diagrams:build
```

Requires `@mermaid-js/mermaid-cli` (installed on demand via `pnpm diagrams:build`).
