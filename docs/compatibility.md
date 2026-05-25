# Provider compatibility matrix

Living document — update when adapters ship or provider quirks are discovered.

**Current package status:** Stable `1.0.0` — core, OpenAI Chat Completions, OpenAI-compatible, Anthropic Messages, OpenAI Responses, transforms, replay helpers, and examples are functional. Additional provider adapters (e.g. Gemini) remain planned; see [`post-1.0-provider-roadmap.md`](./post-1.0-provider-roadmap.md).

| Provider / API          | Adapter                   | Text | Tools | Reasoning    | Refusal     | JSON stream  | Usage        | Multi-choice | Status |
| ----------------------- | ------------------------- | ---- | ----- | ------------ | ----------- | ------------ | ------------ | ------------ | ------ |
| OpenAI Chat Completions | `openaiChatAdapter`       | yes  | yes   | best-effort  | yes         | yes²         | yes¹         | partial³     | v0.2   |
| OpenAI-compatible       | `openaiCompatibleAdapter` | yes  | yes   | best-effort  | best-effort | best-effort⁴ | best-effort⁵ | partial³     | v0.3   |
| Anthropic Messages      | `anthropicAdapter`        | yes  | yes   | yes          | yes         | best-effort⁶ | yes          | —            | v0.4   |
| OpenAI Responses        | `openaiResponsesAdapter`  | yes  | yes   | best-effort⁷ | yes         | best-effort⁸ | best-effort  | —            | v0.7   |
| Gemini                  | TBD                       | —    | —     | —            | —           | —            | —            | —            | v0.2+  |

¹ OpenAI usage in stream requires `stream_options: { include_usage: true }` on the request.
² JSON mode requires `openaiChatAdapter({ jsonMode: true })` because OpenAI streams JSON mode as normal content deltas.
³ Adapter preserves `choiceIndex`; Phase 1 core currently emits one terminal finish event per consumed stream.
⁴ JSON mode requires `openaiCompatibleAdapter({ jsonMode: true })`.
⁵ Usage fields vary by host; adapter supports OpenAI fields plus `input_tokens` / `output_tokens` aliases.
⁶ Anthropic structured JSON is supported through JSON mode text blocks or tool input streams; schema validation is out of scope.
⁷ OpenAI Responses reasoning support is limited to string summary/detail fields.
⁸ JSON mode requires `openaiResponsesAdapter({ jsonMode: true })`.

## Legend

- **planned** — not yet implemented
- **best-effort** — depends on host API (OpenRouter, Groq, Ollama, etc.)
- **—** — not applicable or not planned for that adapter

## Known provider quirks

Document host-specific deviations here as they are discovered during adapter implementation.

| Host               | Quirk                                                         | Workaround                                                            |
| ------------------ | ------------------------------------------------------------- | --------------------------------------------------------------------- |
| OpenAI Chat        | Legacy `function_call` lacks tool_call ids                    | Adapter maps it to synthetic `legacy_function:<choiceIndex>` tool ids |
| OpenAI Chat        | Streaming usage is omitted unless requested                   | Set `stream_options: { include_usage: true }`                         |
| OpenAI Chat        | JSON mode streams as `delta.content`                          | Use `openaiChatAdapter({ jsonMode: true })`                           |
| OpenAI-compatible  | Local hosts may omit `id`, `model`, or `created`              | Compatible adapter tolerates missing metadata by default              |
| OpenAI-compatible  | Some hosts omit tool call ids                                 | Core synthesizes stable ids by tool index                             |
| OpenAI-compatible  | Some hosts return loose error shapes                          | `looseErrorShape` is enabled by default                               |
| OpenAI-compatible  | OpenRouter/Groq/Together/Fireworks dialects can vary by model | Provider presets are best-effort and fixture-tested                   |
| Anthropic Messages | Tool use input may stream as invalid partial JSON             | Core emits best-effort partial previews and assembles final args      |
| Anthropic Messages | Extended thinking uses thinking blocks                        | Adapter maps thinking deltas to `reasoning.*` detail events           |
| Anthropic Messages | Usage can arrive on message_start and message_delta           | Adapter emits usage chunks whenever token fields are present          |
| OpenAI Responses   | Function call args stream as event-name payloads              | Adapter maps them to unified `tool_call.*` events                     |
| OpenAI Responses   | Realtime/audio/multimodal binary output is not handled        | Out of scope for this adapter                                         |

## OpenAI-compatible limitations

- Provider presets are best-effort; CI does not call live provider APIs.
- Hosts can change OpenAI-compatible dialects without notice.
- Non-string reasoning payloads are skipped.
- Multi-choice terminal behavior is limited by the current core single terminal
  finish event.

## Provider-agnostic transforms

`collectStream`, `tapEvents`, `toSSE`, and `assembleFromFile` operate on unified
`StreamEvent`s or local fixtures and work with all adapters. `assembleFromFile` is
Node-only because it reads local files with `node:fs/promises`.
