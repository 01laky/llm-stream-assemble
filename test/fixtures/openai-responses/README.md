# OpenAI Responses Fixtures

All fixtures are synthetic, documentation-shaped, or redacted-live. They contain
no API keys, private prompts, account ids, organization ids, or live request ids.

| Fixture                         | Source      | Notes                                         |
| ------------------------------- | ----------- | --------------------------------------------- |
| `text-basic.*`                  | synthetic   | Basic output text stream                      |
| `function-call.*`               | docs-shaped | Function call item and argument deltas        |
| `args-before-item.*`            | synthetic   | Args delta before output item                 |
| `refusal.*`                     | synthetic   | Refusal delta stream                          |
| `failed.*`                      | synthetic   | Provider failure lifecycle                    |
| `incomplete.*`                  | synthetic   | Incomplete lifecycle                          |
| `json-mode.*`                   | synthetic   | Output text as JSON mode                      |
| `parallel-function-call.*`      | synthetic   | Parallel function call state                  |
| `response-text.*`               | synthetic   | Non-stream text response                      |
| `response-function-call.*`      | docs-shaped | Non-stream function call response             |
| `response-failed.*`             | synthetic   | Non-stream failed response                    |
| `logprobs-stream.*`             | synthetic   | Streaming `output_text.delta` logprobs        |
| `logprobs-done-batch.*`         | synthetic   | Done-only logprob batch on `output_text.done` |
| `logprobs-json-mode.*`          | synthetic   | JSON mode + logprobs ordering                 |
| `logprobs-refusal.*`            | synthetic   | Refusal delta logprobs                        |
| `logprobs-refusal-response.*`   | synthetic   | Non-stream refusal part logprobs              |
| `logprobs-tool-stream.*`        | synthetic   | Logprobs interleaved with tool stream         |
| `logprobs-multi-output.*`       | synthetic   | `output_index` → `choiceIndex`                |
| `logprobs-failed-stream.*`      | synthetic   | Logprobs before `response.failed`             |
| `logprobs-content-part-added.*` | synthetic   | Logprobs on `content_part.added`              |
| `logprobs-response.*`           | synthetic   | Non-stream `output_text` part logprobs        |

**Conformance IDs:** **LSA-LF06**–**LF11** (Responses logprobs golden parity in `test/logprobs-conformance.test.ts`).

Regenerate logprob goldens: `node scripts/generate-openai-responses-logprob-fixtures.mjs` (check: `--check`). Live capture workflow: `pnpm smoke:openai-responses-logprobs --capture` — see [`docs/live-smoke.md`](../../../docs/live-smoke.md#openai-responses-logprobs).
