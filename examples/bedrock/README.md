# AWS Bedrock examples

Bedrock **ConverseStream** responses are often `application/vnd.amazon.eventstream` (binary). This library accepts **decoded JSON event strings** — not raw bytes.

```
Browser/App → Bedrock Runtime API → EventStream bytes → [SDK or decode helper] → JSON strings
  → bedrockAdapter().parseChunk / assembleFromPayloads / assembleStream → StreamEvent[]
```

## Files

| File                                                                                 | Purpose                                                                           |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| [`decode-event-stream.ts`](./decode-event-stream.ts)                                 | Minimal zero-dep EventStream decoder for tests and Workers (not production-grade) |
| [`decode-event-stream-note.ts`](./decode-event-stream-note.ts)                       | Doc re-export                                                                     |
| [`../node-fetch/bedrock.ts`](../node-fetch/bedrock.ts)                               | Offline `eventLines` example                                                      |
| [`../integrations/bedrock-worker-proxy.ts`](../integrations/bedrock-worker-proxy.ts) | Worker proxy recipe                                                               |

## Decode boundary

- **`bedrockAdapter`** — maps one decoded ConverseStream JSON object per `parseChunk` call.
- **Binary EventStream** — decode in your app, AWS SDK v3 (`ConverseStreamCommand` async iterator), or `decode-event-stream.ts`.
- **IAM / signing** — not handled by this library.

See also [`docs/adapter-guide.md`](../../docs/adapter-guide.md), [`docs/compatibility.md`](../../docs/compatibility.md), [`docs/integration-cookbook.md`](../../docs/integration-cookbook.md).
