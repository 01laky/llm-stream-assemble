# Anthropic Fixtures

All fixtures are synthetic and documentation-shaped. They contain no API keys,
private prompts, account ids, organization ids, or live request ids.

| Fixture            | Source                | Notes                                              |
| ------------------ | --------------------- | -------------------------------------------------- |
| `text-basic.*`     | synthetic/docs-shaped | Basic Messages stream with text block              |
| `tool-use.*`       | synthetic/docs-shaped | Streaming `tool_use` block with `input_json_delta` |
| `tool-parallel.*`  | synthetic/docs-shaped | Parallel `tool_use` blocks                         |
| `usage-stream.*`   | synthetic/docs-shaped | Text stream with usage deltas                      |
| `json-mode.*`      | synthetic/docs-shaped | Text block mapped with `jsonMode: true`            |
| `incomplete.*`     | synthetic             | Truncated stream without `message_stop`            |
| `empty-stream.*`   | synthetic             | `message_start` + `message_stop` only              |
| `thinking.*`       | synthetic/docs-shaped | Extended thinking block                            |
| `refusal.*`        | synthetic             | Refusal content block                              |
| `provider-error.*` | synthetic/docs-shaped | Top-level Anthropic stream error event             |
| `response-text.*`  | synthetic             | Non-stream text response                           |
| `response-tool.*`  | synthetic/docs-shaped | Non-stream tool_use response                       |
