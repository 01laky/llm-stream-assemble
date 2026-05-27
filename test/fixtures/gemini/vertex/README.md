# Vertex AI Gemini fixtures

Synthetic, documentation-shaped payloads for `geminiAdapter({ apiSurface: "vertex" })`.
No API keys, project ids, live request ids, or captured production traffic.

Parent Google AI fixtures live in [`../README.md`](../README.md). Vertex `.jsonl` lines are derived from the same inner `GenerateContentResponse` shapes where possible (**LSA-GV97** parity).

## Regenerate expected files

```bash
pnpm build
pnpm fixtures:generate-gemini
pnpm fixtures:check-gemini   # CI / verify gate
```

Optional: `--surface=vertex` limits generation to this directory.

## Provenance

| Fixture                       | Source                | Model (if applicable) | Notes                                             |
| ----------------------------- | --------------------- | --------------------- | ------------------------------------------------- |
| `text-basic`                  | synthetic (from SSE)  | gemini-2.5-flash      | JSONL mirror of Google AI `text-basic`            |
| `text-unicode`                | synthetic             | gemini-2.5-flash      | Emoji and CJK text                                |
| `text-empty-parts`            | synthetic             | —                     | Empty/whitespace text parts skipped               |
| `tool-single`                 | synthetic/docs-shaped | —                     | functionCall across chunks                        |
| `tool-parallel`               | synthetic             | —                     | Two parallel functionCalls                        |
| `tool-args-object`            | synthetic             | —                     | Growing `args` object                             |
| `tool-partial-args`           | docs-shaped           | —                     | `partialArgs` + `willContinue`                    |
| `tool-name-before-args`       | synthetic             | —                     | Name before args chunks                           |
| `tool-flush-without-terminal` | synthetic             | —                     | STOP while tool args still open                   |
| `json-mode`                   | synthetic             | —                     | JSON text (`jsonMode: true`)                      |
| `thinking`                    | synthetic             | —                     | `thought: true` reasoning parts                   |
| `usage-only`                  | synthetic             | —                     | usageMetadata without candidates                  |
| `metadata-early`              | synthetic             | gemini-2.5-flash      | responseId on first chunk                         |
| `finish-max-tokens`           | synthetic             | —                     | MAX_TOKENS finishReason                           |
| `finish-safety`               | synthetic             | —                     | SAFETY finishReason                               |
| `prompt-blocked`              | synthetic             | —                     | promptFeedback.blockReason                        |
| `provider-error`              | synthetic             | —                     | Top-level error object                            |
| `incomplete`                  | synthetic             | —                     | No finishReason (core incomplete flush)           |
| `empty-candidates`            | synthetic             | —                     | Empty candidates then text                        |
| `envelope-wrapped`            | synthetic             | —                     | `{ response: … }` wrapper per line                |
| `envelope-tuned-endpoint`     | synthetic             | —                     | Tuned-model endpoint envelope variant             |
| `grounding-metadata`          | synthetic             | —                     | Grounding → typed `grounding` events (**CF03**)   |
| `grounding-chunks`            | synthetic             | —                     | Grounding chunk payloads assemble without throw   |
| `unknown-envelope`            | synthetic             | —                     | Trace-only object → `metadata.raw` forward compat |
| `response-text`               | synthetic             | gemini-2.5-flash      | Non-stream wrapped body                           |
| `response-tool`               | synthetic             | —                     | Non-stream functionCall                           |
| `response-blocked`            | synthetic             | —                     | promptFeedback only                               |
| `response-error`              | synthetic             | —                     | Top-level error body                              |

**API surface:** Vertex `{region}-aiplatform.googleapis.com` `streamGenerateContent` / `generateContent` — one JSON object string per `.jsonl` line after HTTP decode.

**Redaction:** Hand-authored or generated from checked-in Google AI SSE via `scripts/generate-gemini-fixtures.mjs`; live capture via `pnpm smoke:vertex --capture` must be reviewed before commit.
