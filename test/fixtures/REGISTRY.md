# Fixture registry

Machine-readable catalog lives in `test/helpers/fixture-catalog.ts` (`discoverStreamFixtures`, `discoverResponseFixtures`).

## Summary

| Metric | Count |
| --- | ---: |
| Stream fixtures | 171 |
| Tier-1 stream fixtures | 169 |
| Response fixtures | 36 |
| Evil-offset samples | 10 |

## Exclusions

- `cohere/response-format-json.jsonl` — excluded from chunk/conformance matrices (stale jsonMode golden).
- `transforms/*` except `transforms/malformed.sse` — transform pipeline fixtures, not adapter goldens.
- `bedrock/event-stream-bytes.jsonl` — tier-3 binary envelope sample.

## Adapter stream counts

| Adapter key | Fixtures |
| --- | ---: |
| anthropic | 10 |
| bedrock | 15 |
| cohere | 17 |
| gemini | 20 |
| gemini-vertex | 24 |
| openai-chat | 14 |
| openai-compatible | 9 |
| openai-compatible/azure | 8 |
| openai-compatible/cloudflare | 6 |
| openai-compatible/deepseek | 4 |
| openai-compatible/fireworks | 2 |
| openai-compatible/groq | 5 |
| openai-compatible/lmstudio | 2 |
| openai-compatible/mistral | 3 |
| openai-compatible/ollama | 3 |
| openai-compatible/openrouter | 2 |
| openai-compatible/perplexity | 4 |
| openai-compatible/together | 2 |
| openai-compatible/xai | 4 |
| openai-responses | 16 |
| unknown | 1 |

## Tier-1 stream fixture IDs

- anthropic/empty-stream.sse
- anthropic/incomplete.sse
- anthropic/json-mode.sse
- anthropic/provider-error.sse
- anthropic/refusal.sse
- anthropic/text-basic.sse
- anthropic/thinking.sse
- anthropic/tool-parallel.sse
- anthropic/tool-use.sse
- anthropic/usage-stream.sse
- bedrock/anthropic-delta-variant.jsonl
- bedrock/guardrail-intervened.jsonl
- bedrock/incomplete.jsonl
- bedrock/json-mode.jsonl
- bedrock/nova-text-basic.jsonl
- bedrock/provider-error.jsonl
- bedrock/text-basic.jsonl
- bedrock/text-basic.sse
- bedrock/text-unicode.jsonl
- bedrock/tool-parallel.jsonl
- bedrock/tool-partial-input.jsonl
- bedrock/tool-single.jsonl
- bedrock/tool-single.sse
- bedrock/usage-metadata.jsonl
- cohere/citations-interleaved.jsonl
- cohere/citations-stream.jsonl
- cohere/incomplete.jsonl
- cohere/json-mode.jsonl
- cohere/provider-error.jsonl
- cohere/text-basic.jsonl
- cohere/text-basic.sse
- cohere/text-empty.jsonl
- cohere/text-unicode.jsonl
- cohere/tool-late-id.jsonl
- cohere/tool-no-plan.jsonl
- cohere/tool-parallel.jsonl
- cohere/tool-partial-input.jsonl
- cohere/tool-plan.jsonl
- cohere/tool-single.jsonl
- cohere/tool-single.sse
- cohere/usage-only.jsonl
- gemini/empty-candidates.sse
- gemini/finish-max-tokens.sse
- gemini/finish-safety.sse
- gemini/grounding-metadata.sse
- gemini/incomplete.sse
- gemini/json-mode.sse
- gemini/metadata-early.sse
- gemini/prompt-blocked.sse
- gemini/provider-error.sse
- gemini/text-basic.sse
- gemini/text-empty-parts.sse
- gemini/text-unicode.sse
- gemini/thinking.sse
- gemini/tool-args-object.sse
- gemini/tool-flush-without-terminal.sse
- gemini/tool-name-before-args.sse
- gemini/tool-parallel.sse
- gemini/tool-partial-args.sse
- gemini/tool-single.sse
- gemini/usage-only.sse
- gemini/vertex/empty-candidates.jsonl
- gemini/vertex/envelope-tuned-endpoint.jsonl
- gemini/vertex/envelope-wrapped.jsonl
- gemini/vertex/finish-max-tokens.jsonl
- gemini/vertex/finish-safety.jsonl
- gemini/vertex/grounding-chunks.jsonl
- gemini/vertex/grounding-metadata.jsonl
- gemini/vertex/incomplete.jsonl
- gemini/vertex/json-mode.jsonl
- gemini/vertex/metadata-early.jsonl
- gemini/vertex/prompt-blocked.jsonl
- gemini/vertex/provider-error.jsonl
- gemini/vertex/text-basic.jsonl
- gemini/vertex/text-empty-parts.jsonl
- gemini/vertex/text-unicode.jsonl
- gemini/vertex/thinking.jsonl
- gemini/vertex/tool-args-object.jsonl
- gemini/vertex/tool-flush-without-terminal.jsonl
- gemini/vertex/tool-name-before-args.jsonl
- gemini/vertex/tool-parallel.jsonl
- gemini/vertex/tool-partial-args.jsonl
- gemini/vertex/tool-single.jsonl
- gemini/vertex/unknown-envelope.jsonl
- gemini/vertex/usage-only.jsonl
- openai-chat/json-mode.sse
- openai-chat/legacy-function-call.sse
- openai-chat/logprobs-json-mode.sse
- openai-chat/logprobs-multichoice.sse
- openai-chat/logprobs-refusal.sse
- openai-chat/logprobs-stream.sse
- openai-chat/logprobs-tool-stream.sse
- openai-chat/multichoice.sse
- openai-chat/provider-error.sse
- openai-chat/refusal.sse
- openai-chat/text-basic.sse
- openai-chat/tool-parallel.sse
- openai-chat/tool-single.sse
- openai-chat/usage.sse
- openai-compatible/azure/content-filter-block.sse
- openai-compatible/azure/content-filter-metadata.sse
- openai-compatible/azure/json-mode.sse
- openai-compatible/azure/provider-error.sse
- openai-compatible/azure/reasoning-stream.sse
- openai-compatible/azure/text-basic.sse
- openai-compatible/azure/tool-single.sse
- openai-compatible/azure/usage-stream.sse
- openai-compatible/cloudflare/json-mode.sse
- openai-compatible/cloudflare/missing-metadata.sse
- openai-compatible/cloudflare/provider-error.sse
- openai-compatible/cloudflare/text-basic.sse
- openai-compatible/cloudflare/tool-single.sse
- openai-compatible/cloudflare/usage-stream.sse
- openai-compatible/deepseek/provider-error.sse
- openai-compatible/deepseek/reasoning-stream.sse
- openai-compatible/deepseek/text-basic.sse
- openai-compatible/deepseek/tool-single.sse
- openai-compatible/fireworks/text-basic.sse
- openai-compatible/fireworks/tool-single.sse
- openai-compatible/generic-text.sse
- openai-compatible/groq/logprobs-stream.sse
- openai-compatible/groq/missing-metadata.sse
- openai-compatible/groq/missing-tool-id.sse
- openai-compatible/groq/text-basic.sse
- openai-compatible/groq/tool-single.sse
- openai-compatible/json-mode.sse
- openai-compatible/lmstudio/missing-metadata.sse
- openai-compatible/lmstudio/text-basic.sse
- openai-compatible/logprobs-stream.sse
- openai-compatible/loose-error-string.sse
- openai-compatible/missing-choice-index.sse
- openai-compatible/missing-metadata.sse
- openai-compatible/missing-tool-id.sse
- openai-compatible/mistral/missing-metadata.sse
- openai-compatible/mistral/text-basic.sse
- openai-compatible/mistral/tool-parallel.sse
- openai-compatible/ollama/missing-metadata.sse
- openai-compatible/ollama/text-basic.sse
- openai-compatible/ollama/tool-missing-id.sse
- openai-compatible/openrouter/router-metadata.sse
- openai-compatible/openrouter/text-basic.sse
- openai-compatible/perplexity/citations-stream.sse
- openai-compatible/perplexity/missing-metadata.sse
- openai-compatible/perplexity/provider-error.sse
- openai-compatible/perplexity/text-basic.sse
- openai-compatible/reasoning-alias.sse
- openai-compatible/together/reasoning-alias.sse
- openai-compatible/together/text-basic.sse
- openai-compatible/usage-alias.sse
- openai-compatible/xai/missing-metadata.sse
- openai-compatible/xai/reasoning-stream.sse
- openai-compatible/xai/text-basic.sse
- openai-compatible/xai/tool-single.sse
- openai-responses/args-before-item.sse
- openai-responses/failed.sse
- openai-responses/function-call.sse
- openai-responses/incomplete.sse
- openai-responses/json-mode.sse
- openai-responses/logprobs-content-part-added.sse
- openai-responses/logprobs-done-batch.sse
- openai-responses/logprobs-failed-stream.sse
- openai-responses/logprobs-json-mode.sse
- openai-responses/logprobs-multi-output.sse
- openai-responses/logprobs-refusal.sse
- openai-responses/logprobs-stream.sse
- openai-responses/logprobs-tool-stream.sse
- openai-responses/parallel-function-call.sse
- openai-responses/refusal.sse
- openai-responses/text-basic.sse

## Response fixture IDs

- anthropic/response-text
- anthropic/response-tool
- bedrock/response-error
- bedrock/response-text
- bedrock/response-tool
- cohere/response-citations
- cohere/response-error
- cohere/response-format-json
- cohere/response-text
- cohere/response-tool
- gemini/response-blocked
- gemini/response-error
- gemini/response-text
- gemini/response-tool
- gemini/vertex/response-blocked
- gemini/vertex/response-error
- gemini/vertex/response-text
- gemini/vertex/response-tool
- openai-chat/response-json-mode
- openai-chat/response-legacy-function-call
- openai-chat/response-provider-error
- openai-chat/response-refusal
- openai-chat/response-text
- openai-chat/response-tool
- openai-compatible/azure/response-basic
- openai-compatible/azure/response-content-filter
- openai-compatible/cloudflare/response-basic
- openai-compatible/deepseek/response-basic
- openai-compatible/groq/response-basic
- openai-compatible/perplexity/response-citations
- openai-compatible/response-generic
- openai-compatible/response-loose-error
- openai-compatible/xai/response-basic
- openai-responses/response-failed
- openai-responses/response-function-call
- openai-responses/response-text

## Evil-offset sample IDs

- openai-chat/text-basic.sse
- openai-responses/text-basic.sse
- anthropic/text-basic.sse
- gemini/text-basic.sse
- gemini/vertex/text-basic.jsonl
- cohere/text-basic.jsonl
- bedrock/text-basic.jsonl
- openai-compatible/generic-text.sse
- openai-compatible/groq/text-basic.sse
- openai-compatible/azure/content-filter-block.sse

