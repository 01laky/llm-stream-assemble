# Provider compatibility matrix

Living document — update when adapters ship or provider quirks are discovered.

**Current package status:** Stable `1.2.0` — core, OpenAI Chat Completions, OpenAI-compatible (host presets), Anthropic Messages, OpenAI Responses, **Google Gemini (Google AI)**, transforms, replay helpers, and examples are functional. Architecture diagrams: [`docs/img/README.md`](./img/README.md). See [`post-1.0-provider-roadmap.md`](./post-1.0-provider-roadmap.md) for planned providers.

| Provider / API            | Adapter                   | Text | Tools | Reasoning    | Refusal     | JSON stream  | Usage        | Multi-choice | Status |
| ------------------------- | ------------------------- | ---- | ----- | ------------ | ----------- | ------------ | ------------ | ------------ | ------ |
| OpenAI Chat Completions   | `openaiChatAdapter`       | yes  | yes   | best-effort  | yes         | yes²         | yes¹         | partial³     | v0.2   |
| OpenAI-compatible         | `openaiCompatibleAdapter` | yes  | yes   | best-effort  | best-effort | best-effort⁴ | best-effort⁵ | partial³     | v0.3   |
| Anthropic Messages        | `anthropicAdapter`        | yes  | yes   | yes          | yes         | best-effort⁶ | yes          | —            | v0.4   |
| OpenAI Responses          | `openaiResponsesAdapter`  | yes  | yes   | best-effort⁷ | yes         | best-effort⁸ | best-effort  | —            | v0.7   |
| Google Gemini (Google AI) | `geminiAdapter`           | yes  | yes   | best-effort⁹ | —           | yes¹⁰        | yes          | partial³     | v1.1   |

¹ OpenAI usage in stream requires `stream_options: { include_usage: true }` on the request.
² JSON mode requires `openaiChatAdapter({ jsonMode: true })` because OpenAI streams JSON mode as normal content deltas.
³ Adapter preserves `choiceIndex`; Phase 1 core currently emits one terminal finish event per consumed stream.
⁴ JSON mode requires `openaiCompatibleAdapter({ jsonMode: true })`.
⁵ Usage fields vary by host; adapter supports OpenAI fields plus `input_tokens` / `output_tokens` aliases.
⁶ Anthropic structured JSON is supported through JSON mode text blocks or tool input streams; schema validation is out of scope.
⁷ OpenAI Responses reasoning support is limited to string summary/detail fields.
⁸ JSON mode requires `openaiResponsesAdapter({ jsonMode: true })`.
⁹ Gemini `thought` parts map to `reasoning.*` detail events when present.
¹⁰ JSON mode requires `geminiAdapter({ jsonMode: true })`.

## Legend

- **best-effort** — depends on host API or model revision
- **—** — not applicable or not mapped to dedicated unified events

## Known provider quirks

| Host               | Quirk                                                               | Workaround                                                             |
| ------------------ | ------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| OpenAI Chat        | Legacy `function_call` lacks tool_call ids                          | Adapter maps it to synthetic `legacy_function:<choiceIndex>` tool ids  |
| OpenAI Chat        | Streaming usage is omitted unless requested                         | Set `stream_options: { include_usage: true }`                          |
| OpenAI Chat        | JSON mode streams as `delta.content`                                | Use `openaiChatAdapter({ jsonMode: true })`                            |
| OpenAI-compatible  | Local hosts may omit `id`, `model`, or `created`                    | Compatible adapter tolerates missing metadata by default               |
| OpenAI-compatible  | Some hosts omit tool call ids                                       | Core synthesizes stable ids by tool index                              |
| OpenAI-compatible  | Some hosts return loose error shapes                                | `looseErrorShape` is enabled by default                                |
| OpenAI-compatible  | OpenRouter/Groq/Together/Fireworks dialects can vary by model       | Provider presets are best-effort and fixture-tested per host           |
| Groq               | Sparse metadata; usage varies by model                              | Use `provider: "groq"`; missing `id`/`model` tolerated by default      |
| DeepSeek           | R1-style models emit `reasoning_content` in delta                   | Use `provider: "deepseek"` for reasoning alias mapping                 |
| Mistral            | Parallel tool calls; metadata may be sparse on some endpoints       | Use `provider: "mistral"`; tool ids synthesized when missing           |
| Ollama             | Local host omits ids and usage on many models                       | Use `provider: "ollama"`; live smoke via `pnpm smoke:ollama`           |
| LM Studio          | Local host; sparse metadata like Ollama                             | Use `provider: "lmstudio"`                                             |
| Together           | Reasoning via `reasoning` / `reasoning_delta` fields                | Use `provider: "together"` — not the generic `thinking` alias          |
| Fireworks          | OpenAI-like; tool and usage details vary by model                   | Use `provider: "fireworks"`                                            |
| OpenRouter         | Router metadata and multi-model routing headers                     | Use `provider: "openrouter"`; extra fields may appear in raw           |
| Perplexity         | Citations/search metadata on stream or response                     | Preserved in `metadata.raw`; no dedicated `citation.*` events in 1.x   |
| Perplexity         | Non-text delta fields (images, multimodal parts) ignored            | Out of scope; adapter does not throw on unknown delta keys             |
| Perplexity         | Model list and response shape may change independently              | Presets are best-effort and fixture-tested                             |
| xAI                | OpenAI-compatible Grok API; preset key is `xai` not `grok`          | Use `provider: "xai"`; `reasoning_content` mapped via base parser      |
| xAI                | Non-text delta fields ignored without throw                         | Multimodal extras out of scope for 1.x                                 |
| Azure OpenAI       | Deployment URL + `api-key` header; not Bearer auth                  | Use `provider: "azure"`; see README Azure OpenAI Usage                 |
| Azure OpenAI       | Stricter preset rejects unrecognizable payloads by default          | Override with `allowMissingMetadata: true` on lossy gateways only      |
| Azure OpenAI       | Content filter results on stream/response                           | Preserved in `metadata.raw`; refusal + `finish_reason: content_filter` |
| Anthropic Messages | Tool use input may stream as invalid partial JSON                   | Core emits best-effort partial previews and assembles final args       |
| Anthropic Messages | Extended thinking uses thinking blocks                              | Adapter maps thinking deltas to `reasoning.*` detail events            |
| Anthropic Messages | Usage can arrive on message_start and message_delta                 | Adapter emits usage chunks whenever token fields are present           |
| OpenAI Responses   | Function call args stream as event-name payloads                    | Adapter maps them to unified `tool_call.*` events                      |
| OpenAI Responses   | Realtime/audio/multimodal binary output is not handled              | Out of scope for this adapter                                          |
| Google Gemini      | Tool args may stream via `partialArgs` + `willContinue`             | Adapter emits incremental `tool_call.args.delta`; core assembles       |
| Google Gemini      | Stream may end with `finishReason: STOP` before terminal tool chunk | Core flush completes open tools on stream end                          |
| Google Gemini      | No `refusal.*` events — safety uses `promptFeedback` / finish       | Map blocked prompts to `error` + `finish`; SAFETY → `content_filter`   |
| Google Gemini      | Vertex AI / Interactions API differ from Google AI SSE              | Deferred — adapter targets Google AI `streamGenerateContent` only      |
| Google Gemini      | Multimodal `inlineData` / `fileData` parts ignored                  | Out of scope for v1.1                                                  |

## OpenAI-compatible limitations

- Provider presets are best-effort; CI does not call live provider APIs.
- Hosts can change OpenAI-compatible dialects without notice.
- Non-string reasoning payloads are skipped.
- Multi-choice terminal behavior is limited by the current core single terminal finish event.

## Provider-agnostic transforms

`collectStream`, `tapEvents`, `toSSE`, and `assembleFromFile` operate on unified
`StreamEvent`s or local fixtures and work with all adapters. `assembleFromFile` is
Node-only because it reads local files with `node:fs/promises`.
