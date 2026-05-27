# Bedrock fixtures

Synthetic ConverseStream decoded JSON payloads for offline CI. **No live AWS calls.**

## Provenance

| Fixture                         | Source      | API            | Model hint  | Exercises                           |
| ------------------------------- | ----------- | -------------- | ----------- | ----------------------------------- |
| `text-basic.jsonl` / `.sse`     | synthetic   | ConverseStream | openai-like | Text + usage + dual-path parity     |
| `text-unicode.jsonl`            | synthetic   | ConverseStream | —           | Unicode text                        |
| `tool-single.jsonl` / `.sse`    | synthetic   | ConverseStream | —           | Single tool use                     |
| `tool-parallel.jsonl`           | synthetic   | ConverseStream | —           | Parallel tools                      |
| `tool-partial-input.jsonl`      | synthetic   | ConverseStream | —           | Incremental tool JSON               |
| `json-mode.jsonl`               | synthetic   | ConverseStream | —           | `jsonMode: true`                    |
| `provider-error.jsonl`          | docs-shaped | ConverseStream | —           | `modelStreamErrorException`         |
| `usage-metadata.jsonl`          | synthetic   | ConverseStream | —           | Trailing usage only                 |
| `incomplete.jsonl`              | synthetic   | ConverseStream | —           | No `messageStop`                    |
| `nova-text-basic.jsonl`         | synthetic   | ConverseStream | Amazon Nova | `modelFamily: nova`                 |
| `guardrail-intervened.jsonl`    | docs-shaped | ConverseStream | —           | Guardrail stop + trace              |
| `anthropic-delta-variant.jsonl` | synthetic   | ConverseStream | Claude      | `reasoningContent` delta            |
| `event-stream-bytes.bin`        | synthetic   | EventStream    | —           | Binary encode of `text-basic` lines |
| `event-stream-bytes.jsonl`      | synthetic   | ConverseStream | —           | Provenance for `.bin`               |
| `response-text.json`            | synthetic   | Converse       | —           | `parseResponse` text                |
| `response-tool.json`            | synthetic   | Converse       | —           | `parseResponse` tool                |
| `response-error.json`           | docs-shaped | Converse       | —           | `validationException`               |

Each stream fixture has a matching `*.expected.json` golden `StreamEvent[]`.
