# OpenAI Responses Fixtures

All fixtures are synthetic, documentation-shaped, or redacted-live. They contain
no API keys, private prompts, account ids, organization ids, or live request ids.

| Fixture                    | Source      | Notes                                  |
| -------------------------- | ----------- | -------------------------------------- |
| `text-basic.*`             | synthetic   | Basic output text stream               |
| `function-call.*`          | docs-shaped | Function call item and argument deltas |
| `args-before-item.*`       | synthetic   | Args delta before output item          |
| `refusal.*`                | synthetic   | Refusal delta stream                   |
| `failed.*`                 | synthetic   | Provider failure lifecycle             |
| `incomplete.*`             | synthetic   | Incomplete lifecycle                   |
| `json-mode.*`              | synthetic   | Output text as JSON mode               |
| `parallel-function-call.*` | synthetic   | Parallel function call state           |
| `response-text.*`          | synthetic   | Non-stream text response               |
| `response-function-call.*` | docs-shaped | Non-stream function call response      |
| `response-failed.*`        | synthetic   | Non-stream failed response             |
