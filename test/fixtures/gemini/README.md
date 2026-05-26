# Gemini fixtures

All fixtures are synthetic and documentation-shaped. They contain no API keys,
private prompts, account ids, or live request ids.

| Fixture                       | Source                | Model (if applicable) | Notes                                   |
| ----------------------------- | --------------------- | --------------------- | --------------------------------------- |
| `text-basic`                  | synthetic             | gemini-2.5-flash      | Multi-chunk text + usage + STOP         |
| `text-unicode`                | synthetic             | gemini-2.5-flash      | Emoji and CJK text                      |
| `text-empty-parts`            | synthetic             | —                     | Empty/whitespace text parts skipped     |
| `tool-single`                 | synthetic/docs-shaped | —                     | functionCall streamed across chunks     |
| `tool-parallel`               | synthetic             | —                     | Two parallel functionCalls              |
| `tool-args-object`            | synthetic             | —                     | Classic growing `args` object           |
| `tool-partial-args`           | docs-shaped           | —                     | `partialArgs` + `willContinue`          |
| `tool-name-before-args`       | synthetic             | —                     | Name before args chunks                 |
| `tool-flush-without-terminal` | synthetic             | —                     | STOP while tool args still open         |
| `json-mode`                   | synthetic             | —                     | JSON text (use `jsonMode: true`)        |
| `thinking`                    | synthetic             | —                     | `thought: true` reasoning parts         |
| `usage-only`                  | synthetic             | —                     | usageMetadata without candidates        |
| `metadata-early`              | synthetic             | gemini-2.5-flash      | responseId on first chunk               |
| `finish-max-tokens`           | synthetic             | —                     | MAX_TOKENS finishReason                 |
| `finish-safety`               | synthetic             | —                     | SAFETY finishReason                     |
| `prompt-blocked`              | synthetic             | —                     | promptFeedback.blockReason              |
| `provider-error`              | synthetic             | —                     | Top-level error object                  |
| `incomplete`                  | synthetic             | —                     | No finishReason (core incomplete flush) |
| `empty-candidates`            | synthetic             | —                     | Empty candidates then text              |
| `response-text`               | synthetic             | gemini-2.5-flash      | Non-stream text response                |
| `response-tool`               | synthetic             | —                     | Non-stream functionCall                 |
| `response-blocked`            | synthetic             | —                     | promptFeedback only                     |
| `response-error`              | synthetic             | —                     | Top-level error body                    |

**API surface:** Google AI `generativelanguage.googleapis.com` GenerateContent / streamGenerateContent (`?alt=sse`).

**Redaction:** All payloads are hand-authored; no live captures.
