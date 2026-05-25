# Provider compatibility matrix

Living document — update when adapters ship or provider quirks are discovered.

**Current package status:** Phase 0 (`0.0.3`) — API stubs only. All feature cells below are **planned** until v0.1.

| Provider / API          | Adapter                   | Text    | Tools   | Reasoning   | Refusal     | JSON stream | Usage       | Multi-choice | Status |
| ----------------------- | ------------------------- | ------- | ------- | ----------- | ----------- | ----------- | ----------- | ------------ | ------ |
| OpenAI Chat Completions | `openaiChatAdapter`       | planned | planned | planned     | planned     | planned     | planned¹    | planned      | v0.1   |
| OpenAI-compatible       | `openaiCompatibleAdapter` | planned | planned | best-effort | best-effort | best-effort | best-effort | best-effort  | v0.1   |
| Anthropic Messages      | `anthropicAdapter`        | planned | planned | planned     | planned     | planned     | planned     | —            | v0.1   |
| OpenAI Responses        | `openaiResponsesAdapter`  | —       | planned | —           | —           | —           | —           | —            | v0.2   |
| Gemini                  | TBD                       | —       | —       | —           | —           | —           | —           | —            | v0.2+  |

¹ OpenAI usage in stream requires `stream_options: { include_usage: true }` on the request.

## Legend

- **planned** — not yet implemented
- **best-effort** — depends on host API (OpenRouter, Groq, Ollama, etc.)
- **—** — not applicable or not planned for that adapter

## Known provider quirks

Document host-specific deviations here as they are discovered during adapter implementation.

| Host | Quirk | Workaround |
| ---- | ----- | ---------- |
| —    | —     | —          |
