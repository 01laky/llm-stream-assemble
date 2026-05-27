# Cohere v2 Chat fixtures

Docs-derived synthetic fixtures matching [Cohere v2 streaming](https://docs.cohere.com/v2/docs/streaming) event shapes. Re-verify against live capture when API key available (`scripts/live-smoke/cohere-chat.mjs --capture`).

| Fixture                 | Source      | Exercises                                         |
| ----------------------- | ----------- | ------------------------------------------------- |
| `text-basic`            | docs-shaped | message-start, content-delta, message-end, usage  |
| `text-unicode`          | docs-shaped | UTF-8 text deltas                                 |
| `text-empty`            | edge        | message-start → message-end without content-delta |
| `tool-single`           | docs-shaped | tool-plan, tool-call start/delta/end              |
| `tool-parallel`         | docs-shaped | multiple tool_calls in one start event            |
| `tool-partial-input`    | synthetic   | incremental JSON argument streaming               |
| `tool-no-plan`          | edge        | tool call without tool-plan-delta                 |
| `tool-late-id`          | edge        | index before stable tool id                       |
| `json-mode`             | synthetic   | jsonMode option                                   |
| `response-format-json`  | synthetic   | structured JSON stream (jsonMode)                 |
| `tool-plan`             | synthetic   | reasoning-delta from tool-plan-delta              |
| `citations-stream`      | docs-shaped | citation-start metadata.raw                       |
| `citations-interleaved` | edge        | citation during content-delta                     |
| `provider-error`        | synthetic   | type error in stream                              |
| `usage-only`            | synthetic   | message-end usage without content                 |
| `incomplete`            | edge        | stream without message-end                        |
| `response-*`            | docs-shaped | parseResponse non-stream bodies                   |

## Mapping notes (1.5.0)

- `tool-plan-delta` → `reasoning-delta` / `variant: "detail"`
- Citations → `metadata.raw` (no dedicated citation events)
- Unknown event types → forward-compat `metadata.raw`
- Cohere is **not** OpenAI-compatible — use `cohereAdapter()` + `parseSSE`

### Late tool id (`tool-late-id`)

When `tool-call-start` has no `id`, the adapter emits `tool_call.start` with placeholder **`cohere:tool:{index}`** (e.g. `cohere:tool:0`). The real id arrives on a later `tool-call-delta`; subsequent `tool_call.args.delta` and `tool_call.done` use the reconciled id. Golden expected output may include a final `tool_call.done` for the placeholder id with empty args — assembler closing stale placeholder state at stream end, not a duplicate real tool call. Tests: **LSA-CO77**, **LSA-CO78**.
