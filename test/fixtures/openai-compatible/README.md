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

Host golden tests **LSA-OC47**–**LSA-OC94**, **LSA-OC108**–**LSA-OC109**, **LSA-OC113**–**LSA-OC141**, and **LSA-OC142**–**LSA-OC169** (via `cloudflare/manifest.json`) call `openaiCompatibleAdapter({ provider: "<host>" })`.

Cross-preset guards:

| Suite                                      | Test ids                                                | File                                                                   |
| ------------------------------------------ | ------------------------------------------------------- | ---------------------------------------------------------------------- |
| Loose host matrix (all non-strict presets) | **LSA-OC211**–**LSA-OC216**                             | `test/openai-compatible-loose-matrix.test.ts`                          |
| Strict host matrix (azure)                 | **LSA-OC218**–**OC218h**                                | `test/openai-compatible-strict-matrix.test.ts`                         |
| Preset reasoning field matrix              | **LSA-OC219**                                           | `test/openai-compatible-reasoning-matrix.test.ts`                      |
| Exhaustive edges + full stream conformance | **LSA-OC220**–**OC241**, **OC228**, **OC231**–**OC234** | `test/openai-compatible-presets-exhaustive.test.ts`                    |
| Cloudflare Workers-AI-specific robust      | **LSA-OC172**–**LSA-OC209**                             | `test/openai-compatible-presets-cloudflare-robust.test.ts`             |
| SSOT preset coverage                       | **LSA-OC73**, **LSA-OC210**, **LSA-RF27**               | `test/openai-compatible-presets-edge.test.ts`, `refactor-core.test.ts` |

| Folder        | Preset key   | Notes                                                                                                                          |
| ------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `groq/`       | `groq`       | Sparse metadata, tools, non-stream response                                                                                    |
| `deepseek/`   | `deepseek`   | `reasoning_content`, tools, provider error, response                                                                           |
| `mistral/`    | `mistral`    | Text, parallel tools, sparse metadata                                                                                          |
| `ollama/`     | `ollama`     | Local sparse metadata and missing tool ids                                                                                     |
| `lmstudio/`   | `lmstudio`   | Local sparse metadata                                                                                                          |
| `together/`   | `together`   | `reasoning` alias (not `thinking`)                                                                                             |
| `fireworks/`  | `fireworks`  | Text and tool streaming                                                                                                        |
| `openrouter/` | `openrouter` | Router metadata fields                                                                                                         |
| `perplexity/` | `perplexity` | Citations/search metadata, provider error, response                                                                            |
| `xai/`        | `xai`        | Grok OpenAI-compatible; reasoning stream, tools                                                                                |
| `azure/`      | `azure`      | Deployment-shaped Chat Completions; content filter, json-mode, strict preset                                                   |
| `cloudflare/` | `cloudflare` | Workers AI REST; sparse metadata, usage chunk finish, json-mode, tools; **`manifest.json`** drives golden/conformance test ids |

### Optional `manifest.json` (per host)

Since **1.3.1**, a host folder may include `manifest.json` mapping fixture names to golden/conformance test ids and `adapterOptions`. The fixture generator reads `adapterOptions` from the manifest; `json-mode` streams still default to `{ jsonMode: true }` when the manifest omits options.

Example (`cloudflare/manifest.json`):

```json
{
	"text-basic": {
		"kind": "stream",
		"goldenTestId": "OC142",
		"conformanceTestId": "OC158"
	},
	"json-mode": {
		"kind": "stream",
		"goldenTestId": "OC169",
		"conformanceTestId": "OC198",
		"adapterOptions": { "jsonMode": true }
	}
}
```

Preset keys and host lists come from **`openai-compatible-presets.ts`** (`OPENAI_COMPATIBLE_PROVIDERS`, `HOST_COMPATIBLE_PRESETS`).

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
