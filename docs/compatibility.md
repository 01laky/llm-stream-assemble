# Provider compatibility matrix

Living document — update when adapters ship or provider quirks are discovered.

**Current package status:** Phase 3 (`0.3.0`) — core, OpenAI Chat Completions, and OpenAI-compatible adapters are functional. Other provider adapters remain planned.

| Provider / API          | Adapter                   | Text    | Tools   | Reasoning   | Refusal     | JSON stream  | Usage        | Multi-choice | Status |
| ----------------------- | ------------------------- | ------- | ------- | ----------- | ----------- | ------------ | ------------ | ------------ | ------ |
| OpenAI Chat Completions | `openaiChatAdapter`       | yes     | yes     | best-effort | yes         | yes²         | yes¹         | partial³     | v0.2   |
| OpenAI-compatible       | `openaiCompatibleAdapter` | yes     | yes     | best-effort | best-effort | best-effort⁴ | best-effort⁵ | partial³     | v0.3   |
| Anthropic Messages      | `anthropicAdapter`        | planned | planned | planned     | planned     | planned      | planned      | —            | v0.1   |
| OpenAI Responses        | `openaiResponsesAdapter`  | —       | planned | —           | —           | —            | —            | —            | v0.2   |
| Gemini                  | TBD                       | —       | —       | —           | —           | —            | —            | —            | v0.2+  |

¹ OpenAI usage in stream requires `stream_options: { include_usage: true }` on the request.
² JSON mode requires `openaiChatAdapter({ jsonMode: true })` because OpenAI streams JSON mode as normal content deltas.
³ Adapter preserves `choiceIndex`; Phase 1 core currently emits one terminal finish event per consumed stream.
⁴ JSON mode requires `openaiCompatibleAdapter({ jsonMode: true })`.
⁵ Usage fields vary by host; adapter supports OpenAI fields plus `input_tokens` / `output_tokens` aliases.

## Legend

- **planned** — not yet implemented
- **best-effort** — depends on host API (OpenRouter, Groq, Ollama, etc.)
- **—** — not applicable or not planned for that adapter

## Known provider quirks

Document host-specific deviations here as they are discovered during adapter implementation.

| Host              | Quirk                                                         | Workaround                                                            |
| ----------------- | ------------------------------------------------------------- | --------------------------------------------------------------------- |
| OpenAI Chat       | Legacy `function_call` lacks tool_call ids                    | Adapter maps it to synthetic `legacy_function:<choiceIndex>` tool ids |
| OpenAI Chat       | Streaming usage is omitted unless requested                   | Set `stream_options: { include_usage: true }`                         |
| OpenAI Chat       | JSON mode streams as `delta.content`                          | Use `openaiChatAdapter({ jsonMode: true })`                           |
| OpenAI-compatible | Local hosts may omit `id`, `model`, or `created`              | Compatible adapter tolerates missing metadata by default              |
| OpenAI-compatible | Some hosts omit tool call ids                                 | Core synthesizes stable ids by tool index                             |
| OpenAI-compatible | Some hosts return loose error shapes                          | `looseErrorShape` is enabled by default                               |
| OpenAI-compatible | OpenRouter/Groq/Together/Fireworks dialects can vary by model | Provider presets are best-effort and fixture-tested                   |

## OpenAI-compatible limitations

- Provider presets are best-effort; CI does not call live provider APIs.
- Hosts can change OpenAI-compatible dialects without notice.
- Non-string reasoning payloads are skipped.
- Multi-choice terminal behavior is limited by the current core single terminal
  finish event.
