# Architecture diagrams

Mermaid sources and pre-rendered SVGs for the README and docs. npm README cannot execute
Mermaid — always commit updated **`.svg`** files alongside **`.mmd`** edits.

| File                      | Purpose                                                                                                    |
| ------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `pipeline.mmd`            | End-to-end bytes → adapters → core → apps (Bedrock EventStream decode, Vertex JSONL decode, Cohere v2 SSE) |
| `adapters-overview.mmd`   | Built-in adapters and compatible presets (`geminiAdapter` Google AI + Vertex AI, `1.5.7`)                  |
| `stream-event.mmd`        | Unified `StreamEvent` union mindmap                                                                        |
| `transforms.mmd`          | `collectStream`, `tapEvents`, `toSSE`, replay, `assembleFromPayloads` (Bedrock + Vertex JSONL)             |
| `quick-decision.mmd`      | Adapter routing decision tree incl. Bedrock ConverseStream, Vertex JSONL, and Cohere v2                    |
| `assembler-lifecycle.mmd` | Stateful assembler vs stateless adapters (Bedrock + Vertex jsonl path, Cohere SSE)                         |
| `chunk-assembly.mmd`      | SSE + Bedrock EventStream + Vertex JSONL decode → unified assembly                                         |

Regenerate after editing sources:

```bash
pnpm diagrams:build
```

Requires `@mermaid-js/mermaid-cli` (installed on demand via `pnpm diagrams:build`).
