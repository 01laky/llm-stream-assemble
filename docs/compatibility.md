# Provider compatibility matrix

Living document — update when adapters ship or provider quirks are discovered.

**Current package status:** Phase 2 (`0.2.0`) — core and OpenAI Chat Completions adapter are functional. Other provider adapters remain planned.

| Provider / API          | Adapter                   | Text    | Tools   | Reasoning   | Refusal     | JSON stream | Usage       | Multi-choice | Status |
| ----------------------- | ------------------------- | ------- | ------- | ----------- | ----------- | ----------- | ----------- | ------------ | ------ |
| OpenAI Chat Completions | `openaiChatAdapter`       | yes     | yes     | best-effort | yes         | yes²        | yes¹        | partial³     | v0.2   |
| OpenAI-compatible       | `openaiCompatibleAdapter` | planned | planned | best-effort | best-effort | best-effort | best-effort | best-effort  | v0.1   |
| Anthropic Messages      | `anthropicAdapter`        | planned | planned | planned     | planned     | planned     | planned     | —            | v0.1   |
| OpenAI Responses        | `openaiResponsesAdapter`  | —       | planned | —           | —           | —           | —           | —            | v0.2   |
| Gemini                  | TBD                       | —       | —       | —           | —           | —           | —           | —            | v0.2+  |

¹ OpenAI usage in stream requires `stream_options: { include_usage: true }` on the request.
² JSON mode requires `openaiChatAdapter({ jsonMode: true })` because OpenAI streams JSON mode as normal content deltas.
³ Adapter preserves `choiceIndex`; Phase 1 core currently emits one terminal finish event per consumed stream.

## Legend

- **planned** — not yet implemented
- **best-effort** — depends on host API (OpenRouter, Groq, Ollama, etc.)
- **—** — not applicable or not planned for that adapter

## Known provider quirks

Document host-specific deviations here as they are discovered during adapter implementation.

| Host        | Quirk                                       | Workaround                                                            |
| ----------- | ------------------------------------------- | --------------------------------------------------------------------- |
| OpenAI Chat | Legacy `function_call` lacks tool_call ids  | Adapter maps it to synthetic `legacy_function:<choiceIndex>` tool ids |
| OpenAI Chat | Streaming usage is omitted unless requested | Set `stream_options: { include_usage: true }`                         |
| OpenAI Chat | JSON mode streams as `delta.content`        | Use `openaiChatAdapter({ jsonMode: true })`                           |
