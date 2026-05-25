# Anthropic Fixtures

All fixtures are synthetic and documentation-shaped. They contain no API keys,
private prompts, account ids, organization ids, or live request ids.

| Fixture            | Source                | Notes                                              |
| ------------------ | --------------------- | -------------------------------------------------- |
| `text-basic.*`     | synthetic/docs-shaped | Basic Messages stream with text block              |
| `tool-use.*`       | synthetic/docs-shaped | Streaming `tool_use` block with `input_json_delta` |
| `thinking.*`       | synthetic/docs-shaped | Extended thinking block                            |
| `refusal.*`        | synthetic             | Refusal content block                              |
| `provider-error.*` | synthetic/docs-shaped | Top-level Anthropic stream error event             |
| `response-text.*`  | synthetic             | Non-stream text response                           |
| `response-tool.*`  | synthetic/docs-shaped | Non-stream tool_use response                       |
