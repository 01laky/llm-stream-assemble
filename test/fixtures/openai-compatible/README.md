# OpenAI-Compatible Fixtures

All fixtures are synthetic and contain no API keys, private prompts, account ids,
organization ids, or live request ids.

| Fixture                  | Source    | Provider shape                                        |
| ------------------------ | --------- | ----------------------------------------------------- |
| `generic-text.*`         | synthetic | Generic OpenAI-compatible text stream                 |
| `missing-metadata.*`     | synthetic | Ollama/LM Studio-like local host with sparse metadata |
| `missing-choice-index.*` | synthetic | Host omits `choices[].index`                          |
| `missing-tool-id.*`      | synthetic | Host omits `tool_calls[].id`                          |
| `loose-error-string.*`   | synthetic | Nonstandard string error shape                        |
| `reasoning-alias.*`      | synthetic | Host emits `thinking` reasoning alias                 |
| `usage-alias.*`          | synthetic | Host emits `input_tokens` / `output_tokens`           |
| `json-mode.*`            | synthetic | JSON mode content mapped via adapter option           |
| `response-generic.*`     | synthetic | Non-stream generic response                           |
| `response-loose-error.*` | synthetic | Non-stream loose provider error                       |
