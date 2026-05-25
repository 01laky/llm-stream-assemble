# OpenAI Chat Fixtures

All fixtures are synthetic or documentation-shaped. They contain no API keys,
private prompts, account ids, organization ids, or live request ids.

| Fixture                           | Source                | Notes                                          |
| --------------------------------- | --------------------- | ---------------------------------------------- |
| `text-basic.*`                    | synthetic             | Minimal text stream with metadata and `[DONE]` |
| `tool-single.*`                   | synthetic/docs-shaped | Single streamed `tool_calls` function call     |
| `tool-parallel.*`                 | synthetic/docs-shaped | Two streamed tool calls interleaved by index   |
| `legacy-function-call.*`          | synthetic/docs-shaped | Legacy streamed `function_call` shape          |
| `refusal.*`                       | synthetic             | Refusal delta stream                           |
| `usage.*`                         | synthetic/docs-shaped | Usage-only final chunk with reasoning tokens   |
| `multichoice.*`                   | synthetic             | Multi-choice text and finish behavior          |
| `provider-error.*`                | synthetic/docs-shaped | Redacted top-level provider error payload      |
| `json-mode.*`                     | synthetic             | JSON mode content mapped with adapter option   |
| `response-text.*`                 | synthetic             | Non-streaming text response                    |
| `response-tool.*`                 | synthetic/docs-shaped | Non-streaming tool call response               |
| `response-legacy-function-call.*` | synthetic/docs-shaped | Non-streaming legacy function call             |
| `response-refusal.*`              | synthetic             | Non-streaming refusal response                 |
| `response-json-mode.*`            | synthetic             | Non-streaming JSON mode response               |
| `response-provider-error.*`       | synthetic/docs-shaped | Non-streaming provider error body              |
