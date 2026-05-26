# OpenAI-Compatible Fixtures

All fixtures are synthetic and contain no API keys, private prompts, account ids,
organization ids, or live request ids.

## Root fixtures (generic adapter)

Used by **LSA-OC31**–**LSA-OC40** with default `openaiCompatibleAdapter()` (generic preset).

| Fixture                  | Source    | Provider shape                                         |
| ------------------------ | --------- | ------------------------------------------------------ |
| `generic-text.*`         | synthetic | Generic OpenAI-compatible text stream                  |
| `missing-metadata.*`     | synthetic | Ollama/LM Studio-like local host with sparse metadata  |
| `missing-choice-index.*` | synthetic | Host omits `choices[].index`                           |
| `missing-tool-id.*`      | synthetic | Host omits `tool_calls[].id`                           |
| `loose-error-string.*`   | synthetic | Nonstandard string error shape                         |
| `reasoning-alias.*`      | synthetic | Host emits `thinking` reasoning alias (generic preset) |
| `usage-alias.*`          | synthetic | Host emits `input_tokens` / `output_tokens`            |
| `json-mode.*`            | synthetic | JSON mode content mapped via adapter option            |
| `response-generic.*`     | synthetic | Non-stream generic response                            |
| `response-loose-error.*` | synthetic | Non-stream loose provider error                        |

## Host subfolders (preset-specific)

Golden tests **LSA-OC47**–**LSA-OC94**, **LSA-OC108**–**LSA-OC109**, **LSA-OC113**–**LSA-OC141** call `openaiCompatibleAdapter({ provider: "<host>" })`.

| Folder        | Preset key   | Notes                                                                        |
| ------------- | ------------ | ---------------------------------------------------------------------------- |
| `groq/`       | `groq`       | Sparse metadata, tools, non-stream response                                  |
| `deepseek/`   | `deepseek`   | `reasoning_content`, tools, provider error, response                         |
| `mistral/`    | `mistral`    | Text, parallel tools, sparse metadata                                        |
| `ollama/`     | `ollama`     | Local sparse metadata and missing tool ids                                   |
| `lmstudio/`   | `lmstudio`   | Local sparse metadata                                                        |
| `together/`   | `together`   | `reasoning` alias (not `thinking`)                                           |
| `fireworks/`  | `fireworks`  | Text and tool streaming                                                      |
| `openrouter/` | `openrouter` | Router metadata fields                                                       |
| `perplexity/` | `perplexity` | Citations/search metadata, provider error, response                          |
| `xai/`        | `xai`        | Grok OpenAI-compatible; reasoning stream, tools                              |
| `azure/`      | `azure`      | Deployment-shaped Chat Completions; content filter, json-mode, strict preset |

## Regenerating `.expected.json`

After changing adapter logic or SSE/JSON inputs:

```bash
pnpm build
node scripts/generate-compatible-preset-fixtures.mjs
# or single fixture:
node scripts/generate-compatible-preset-fixtures.mjs --host groq --name text-basic
node scripts/generate-compatible-preset-fixtures.mjs --host deepseek --name response-basic --kind response
```

Drift check (runs in `pnpm verify`):

```bash
pnpm fixtures:check-compatible
```
