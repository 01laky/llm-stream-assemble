# Changelog

All notable changes to this project are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/); versioning follows [Semantic Versioning](https://semver.org/).

## [1.9.0]

### Added

- **Chunk-split byte matrix** — tier-1 stream goldens replayed through `assembleStream` / `assembleFromPayloads` at chunk sizes 1–64 (extended tier-1 block through 128/256); **TH01**–**TH28** anchors; **≥1000** parameterized cases in `chunk-split-matrix.test.ts`.
- **Adapter conformance harness v2** — unified **AC** matrix across seven built-in adapters plus generic OpenAI-compatible; shared `assertStreamInvariants` helper.
- **Simulated provider E2E** — injected chunked `fetch` through example/proxy entrypoints (**INT59**–**INT110**); zero paid API in CI.
- **Anthropic fixture parity** — new golden families (parallel tools, usage-only, incomplete, json-mode, empty stream) with **A64**–**A99** coverage rows.
- **Transforms goldens** — expanded `test/fixtures/transforms/` plus **T43**–**T70** roundtrip suite.
- **Deep pipeline hardening** — non-stream `parseResponse` byte-split matrix (**TH21**–**TH25**); evil offset sample (**TH26**–**TH28**); Vertex read-chunk-stream (**INT141**–**INT143**); Bedrock EventStream bytes (**B93**–**B95**); AI SDK / replay mapper matrix (**INT151**–**INT160**); stream concurrency (**X181**–**X183**); malformed catalog (**NR01**–**NR20**); `replay-fixture.ts` matrix (**RP01**–**RP30**).
- **Shared test helpers** — `byte-stream.ts`, `fixture-catalog.ts`, `golden-parity.ts`, `stream-invariants.ts`, `simulated-provider.ts`.
- **`docs/testing-strategy.md`**, auto-generated **`test/fixtures/REGISTRY.md`**, and `fixtures:audit-registry` wired into **`pnpm verify`**.

### Changed

- README test badge **4207**; stable **1.9.0** badges; **`release:prep`** minimum test count gate (**LSA-REL33** ≥ 4000).
- **`examples/node-fetch/replay-fixture.ts`** — optional `adapter` param and JSONL replay support.
- Historical doc pins frozen in `docs-positioning-1.8.1.test.ts`; active pins in **`docs-positioning-1.9.0.test.ts`** (**DOC182**–**DOC198**).

### Notes

- **No public API changes** by design; semver-safe upgrade from **1.8.x**.
- npm publish automation still deferred → **1.10.0**.
- Live smoke scripts remain maintainer-only; not required for CI or release.

## [1.8.1]

### Changed

- Version labels **1.8.1** across docs; README test badge **2136**; README `core-1.8.1-brightgreen` + `status-stable_1.8.1-brightgreen`; `adapters-overview` diagram stable **1.8.1** (SVG regenerated); **`release:prep`** stable badge gates unchanged; **DOC174**–**DOC181**; historical **1.8.0** doc pins in `docs-positioning-1.8.0.test.ts`.

### Notes

- Patch after **1.8.0** npm publish — no adapter or public API changes; semver-safe upgrade from **1.8.0**.

## [1.8.0]

### Added

- **OpenAI Responses API logprobs mapping** — `response.output_text.delta` / `.done`, `response.refusal.delta`, `response.content_part.added`, and non-stream `output_text` / refusal content parts map to existing **`logprob`** events when the request includes `include: ["message.output_text.logprobs"]`; **LSA-RL01**–**RL90**, **R76**–**R85**.
- **Shared helper** `logprobChunksFromResponsesLogprobs()` in `src/adapters/shared/logprobs.ts`.
- **Fixtures** — `test/fixtures/openai-responses/logprobs-*` (stream, done-batch, json-mode, refusal, tool, multi-output, failed-stream, content-part-added, response, refusal-response); generator `scripts/generate-openai-responses-logprob-fixtures.mjs` with **`pnpm fixtures:check-responses-logprobs`** (**MAINT32**).
- **Conformance** — **LF06**–**LF11**, **R71**–**R73**; suites `responses-logprobs-core.test.ts`, `responses-logprobs-edge.test.ts`.
- **Depth parity** — multi-output `choiceIndex`, parser state reset, non-stream refusal parts, AI SDK refusal map (**INT58**), large `top_logprobs`, terminal error after partial logprobs, content-part-added golden.
- **Live smoke** — `pnpm smoke:openai-responses-logprobs` with `--capture` workflow (**DOC171**).
- **Docs** — adapter-guide Chat vs Responses comparison (**DOC172**); **DOC151**–**DOC172**; historical **1.7.0** doc pins revised.

### Changed

- **`openaiResponsesAdapter()`** — emits logprob events before text/refusal/json deltas; done-batch logprobs only when `textSeen === false`; resets `textSeen` and position state per adapter instance.
- **`normalizeResponsesEvents`** — strips `raw` from logprob goldens; strips default `choiceIndex: 0`.
- **`mapFixtureEventsToAISDKParts`** — optional `adapter` for Responses replay.
- **`pnpm verify`** — includes `fixtures:check-responses-logprobs`.
- Version labels **1.8.0** across docs; README test badge **2128**.
- **Stable green release** — README `status-stable_1.8.0-brightgreen` and `core-1.8.0-brightgreen` (not beta blue/pre-release); compatibility matrix OpenAI Responses status **1.8.0**; `adapters-overview` diagram stable **1.8.0** (SVG regenerated); **`release:prep`** asserts stable status and core badges (**LSA-DOC173**, **LSA-REL31**, **LSA-REL32**).

### Notes

- **1.8.0** is a stable semver release — publish to npm `latest`, not `beta`.
- Request must include `include: ["message.output_text.logprobs"]` (documented; not inferred).
- Still deferred: Interactions API, AI21/watsonx presets, npm publish automation.

### Fixed

- Regenerated Gemini `grounding-metadata` goldens (Google AI + Vertex) to fix `fixtures:check-gemini` CI drift on `queries` array formatting.

## [1.7.0]

### Added

- **`logprob` `StreamEvent` type** — first-class unified events for OpenAI Chat Completions `choices[].logprobs` when the request enables logprobs; atomic per-token events (no delta/done lifecycle) with `channel` (`content` | `refusal`), `token`, `logprob`, optional `bytes`, `topLogprobs`, `choiceIndex`, and monotonic `position` per choice/channel; **LSA-LP01**–**LP24**.
- **Shared `src/adapters/shared/logprobs.ts`** — `logprobChunksFromChoiceLogprobs`, position state for streaming increments, `normalizeTopLogprobs`; reused by OpenAI Chat and OpenAI-compatible base parser.
- **`isLogprob` type guard**, **`matchEvent` handler**, and **`collectStream` → `logprobs` array** on `CollectedStream`.
- **`logprobConfidence()`** helper — maps logprob to approximate probability and top-token margin (**LSA-LPA01**–**LPA06**).
- **`alignLogprobsWithText()`** helper — aligns token logprobs to assembled assistant text offsets (**LSA-LPA07**–**LPA12**).
- **Fixtures** — `test/fixtures/openai-chat/logprobs-*.sse|json` (stream, multichoice, refusal, tool, json-mode, response) and `test/fixtures/openai-compatible/logprobs-stream.sse` + `groq/logprobs-stream.sse`; maintainer generator `scripts/generate-openai-logprob-fixtures.mjs` (**LSA-LF01**–**LF08**).
- **Golden / edge coverage** — OpenAI Chat logprob streams and non-stream parity **LSA-OC296**–**OC318**; compatible preset **LSA-OC306**–**OC308**; cross-adapter ordering and null semantics **LSA-LPH01**–**LPH08**, **LSA-X86**–**X98**; extended parser/helper matrix **LSA-LP30**–**LP75**; alignment **LSA-LPA06**–**LPA12**.
- **`pnpm smoke:openai-logprobs`** — live OpenAI Chat Completions smoke with `logprobs: true`; skips when `OPENAI_API_KEY` unset; optional `--capture` to `.local-playground/openai-logprobs-capture/`.
- **`test/docs-positioning-1.7.0.test.ts`** — **LSA-DOC127**–**DOC140** release metadata regressions.
- **Docs / diagrams** — README, compatibility, adapter-guide, faq, edge-cases, integration-cookbook, proposal, roadmap; `stream-event.mmd` + SVG includes Logprob under Provenance.

### Changed

- **OpenAI Chat + compatible parsers** — `choices[].logprobs.content` / `.refusal` arrays emit typed `logprob` events before sibling text/refusal deltas on the same chunk; `logprobs: null` emits nothing (**LSA-LP10**, **LSA-LPH03**).
- **Fixture normalizers** — strip `raw` from `logprob` goldens (OpenAI + compatible maintainers).
- Version labels **1.7.0** across docs; README test badge **1966**.

### Notes

- **OpenAI Responses API** logprobs remain deferred — Chat Completions + compatible presets only in **1.7.0**.
- Still deferred: Interactions API, AI21/watsonx presets, npm publish automation.

## [1.6.0]

### Added

- **`citation` and `grounding` `StreamEvent` types** — first-class unified events for Cohere RAG citations (`citation-start`), Perplexity root `citations` / `search_results`, and Gemini `citationMetadata` / `groundingMetadata` on Google AI and Vertex; atomic events (no delta/done lifecycle); **LSA-CT01**–**CT29**.
- **Shared `src/adapters/shared/citation-grounding.ts`** — Cohere, Perplexity, and Gemini mapping helpers; strips duplicate citation fields from sibling `metadata.raw` unless legacy flag set.
- **`emitLegacyCitationMetadata` adapter option** (default `false`) — opt-in dual-emit of legacy `metadata.raw` citation blobs alongside typed events for migration (**LSA-CT19**–**CT20**, **DOC123**).
- **`isCitation` / `isGrounding` type guards**, **`citationSpanAnchor()`** helper (**LSA-CSA01**–**CSA04**), and `matchEvent` handlers for new types.
- **`collectStream`** — accumulates `citations` and `grounding` arrays on `CollectedStream`.
- **`test/citation-grounding-core.test.ts`** — assembler, transform, toSSE, legacy flag, and pipeline coverage **LSA-CT01**–**CT29**.
- **`test/citation-grounding-conformance.test.ts`** — shared golden parity **LSA-CF01**–**CF04** (Cohere, Perplexity, Vertex, Google AI grounding SSE).
- **`test/citation-span-anchor.test.ts`**, **`test/openai-compatible-citations.test.ts`** — **LSA-CSA01**–**CSA04**, **LSA-OC276**–**OC289**.
- **Cohere / Gemini / cross-adapter edge extensions** — **LSA-CO99**–**CO118**, **LSA-G100**–**G115**, **LSA-GV133**–**GV136**, **LSA-X77**–**X85**.
- **`test/citation-grounding-edge.test.ts`** — extended edge matrix **LSA-CT30**–**CT55** (legacy flags, search_results-only, post-finish drops, tapEvents, transform pipeline, multi-candidate).
- **`test/citation-span-anchor.test.ts`** extended to **LSA-CSA01**–**CSA12**; **LSA-CF05** Cohere response parity; **LSA-OC290**–**OC295** compatible preset matrix; **LSA-G116**/**G117** type guards.
- **Fixtures** — `test/fixtures/gemini/grounding-metadata.sse`, `test/fixtures/cohere/response-citations.json` + regenerated citation/grounding goldens.
- **`test/docs-positioning-1.6.0.test.ts`** — **LSA-DOC110**–**DOC126**; bundle gates **LSA-MAINT24**–**MAINT25**.
- **Docs / diagrams** — README, compatibility, adapter-guide, faq, edge-cases, integration-cookbook, proposal, roadmap; `stream-event.mmd` + SVG includes Citation + Grounding nodes.
- **Examples** — `stream-event-to-ai-sdk-parts.ts` maps `citation` / `grounding` to illustrative parts.

### Changed

- **Cohere `citation-start`** — emits `citation` RawChunk instead of `metadata.raw` (goldens rewritten; **LSA-CO07**, **LSA-CO98** revised).
- **Gemini / Vertex** — `citationMetadata` and `groundingMetadata` emit typed events before text parts (**LSA-G59**, **LSA-GV88**–**GV120** revised in place).
- **Perplexity preset** — root-level citations via shared OpenAI chat parser path; citation before text on same chunk (**LSA-OC99**, **LSA-RF20** revised).
- **Fixture generator `normalize()`** — strips `raw` from `citation` / `grounding` goldens (compatible + gemini maintainers; cohere test helper).
- Version labels **1.6.0** across docs; README test badge **1799**.

### Notes

- Still deferred: logprobs events, Interactions API, AI21/watsonx presets, npm publish automation.

## [1.5.7]

### Added

- **`pnpm smoke:gemini`** — Google AI Gemini live smoke (`scripts/live-smoke/gemini.mjs`) with **`--capture`** to `.local-playground/gemini-capture/`; unified smoke command index in `docs/live-smoke.md` and `examples/README.md`; **LSA-REL28** / **LSA-DOC98** / **LSA-DOC105** / **LSA-DOC106**.
- **`test/openai-chat-conformance.test.ts`** — shared `runAdapterGoldenStream` parity (**LSA-OC253** text+tool, **OC254** refusal, **OC255** json-mode).
- **`test/docs-positioning-1.5.7.test.ts`** — **LSA-DOC97**–**DOC109** release metadata regressions.
- Cross-adapter jsonMode post-finish drops **LSA-X65**–**X70**; **`strictToolArgs`** cross-adapter **LSA-X71**–**X76**.
- **`LSA-MAINT22`** — repo-wide duplicate LSA test ID detector via `test/helpers/lsa-id-audit.ts`.
- **`release-prep.mjs`** — fails when README `tests-N_passing` badge ≠ vitest pass count (**LSA-REL30** / **LSA-DOC109**).

### Changed

- **`docs/edge-cases.md`** — §G version stamp + full provenance for 1.5.6 edge suites and 1.5.7 cross-adapter matrix (**X65**–**X72**, **G89**, **OC256**+); §H post-finish ID list expanded.
- **`docs/proposal.md`**, **`docs/post-1.0-provider-roadmap.md`** — Gemini shipped row; release sequence **1.5.6** / **1.5.7** ✅; Gemini test ranges broken down (conformance, docs-regression, edge, Vertex).
- README **Runtimes** subsection linking to roadmap runtime matrix (**LSA-DOC100**).
- Version labels **1.5.7** across docs; README test badge **1637**.
- Gemini edge ID cleanup: **G64**–**G67**, **G70**, **G71** → **G86**–**G90** (redundant thought edge test removed); §H cites **G89** for post-finish usage.
- OpenAI compatible exhaustive IDs **OC232**–**OC241** → **OC256**–**OC265** (OpenAI Chat edge **OC230**–**OC252** unchanged; conformance **OC253**–**OC255**).
- Live smoke migrated from `gemini.ts` to **`gemini.mjs`** (dist + `assembleStream` pattern).
- **Adapter edge-case depth parity** — Bedrock **LSA-B79**–**B92**, OpenAI Responses **LSA-R59**–**R70**, OpenAI Chat **LSA-OC266**–**OC275**, Gemini **LSA-G91**–**G98**, Anthropic **LSA-A56**–**A63** (post-finish drops, finish matrices, golden regressions, strictToolArgs cross-adapter **X73**–**X76**).

### Notes

- Still deferred: dedicated citation/grounding `StreamEvent` types, Interactions API, AI21/watsonx presets, npm publish automation.

## [1.5.6]

### Added

- **Adapter edge-case suites expanded** — OpenAI Chat (**LSA-OC234**–**OC252**), OpenAI Responses (**LSA-R45**–**R58**), Anthropic (**LSA-A42**–**A55**), Google AI Gemini (**LSA-G70**–**G85**), Bedrock (**LSA-B72**–**B78**), and Cohere duplicate-ID cleanup; dedicated edge files now mirror Cohere/Bedrock/Vertex depth (jsonMode, refusal, reasoning, parallel tools, post-finish drops, provider errors, unicode, finish-reason matrix, golden regressions).
- **`test/docs-positioning-1.5.6.test.ts`** — README/GitHub About composable positioning with Vertex AI in the provider sweep, expanded `package.json` keywords, and **1.5.6** release metadata regressions (**LSA-DOC89**–**DOC96**).

### Changed

- **README blockquote / GitHub About** — composable TypeScript layer positioning with **Vertex AI** in the provider list (`Ollama → Azure → Vertex AI → Bedrock → Cohere → Cloudflare Workers AI`); runtime-deps badge unchanged.
- **`package.json`** — description and keywords expanded (`vertex-ai`, `azure-openai`, `openai-compatible`, `stream-events`, `reasoning`, `json-mode`, `composable`, and related discovery terms).
- **Active doc status labels** — `1.5.6` across README badges, compatibility matrix, adapter guide, FAQ, edge-cases, integration cookbook, performance, comparison, and `adapters-overview.mmd`.
- **`docs/comparison.md`** positioning sentence aligned with composable About while noting zero runtime dependencies as a separate property.
- Version-pinning regression tests updated from **1.5.5** → **1.5.6** where they assert the current release; historical **1.5.5** Vertex entries in CHANGELOG/roadmap tests preserved.

## [1.5.5]

### Added

- **`geminiAdapter({ apiSurface: "vertex" })`** — Vertex AI Gemini on the same adapter as Google AI; **`normalizeVertexChunk()`** strips `response` / `result` / `predictions[0]` wrappers before mapping `GenerateContentResponse` fields; unknown envelopes forward to **`metadata.raw`** for forward compatibility.
- **`GeminiApiSurface`** — `"google-ai"` (default) | `"vertex"` on `GeminiAdapterOptions`.
- **`test/fixtures/gemini/vertex/`** — docs-shaped synthetic `.jsonl` / `.json` / `.expected.json` fixtures (text, tools, thinking, json-mode, envelopes, grounding, errors, usage, non-stream responses); parity with Google AI SSE goldens where payloads align.
- **`examples/node-fetch/vertex-gemini.ts`** — Vertex `streamGenerateContent` via `assembleFromPayloads` + `apiSurface: "vertex"`.
- **`examples/vertex/build-vertex-url.ts`** and **`examples/vertex/read-chunk-stream.ts`** — zero-dep URL builder and JSONL / brace-balanced chunk splitters (examples/tests only; not library exports).
- **`scripts/generate-gemini-fixtures.mjs`** + **`pnpm fixtures:generate-gemini`** / **`pnpm fixtures:check-gemini`** — regenerate or verify Google AI and Vertex golden `expected.json` files.
- **`scripts/live-smoke/vertex-gemini.mjs`** + **`docs/live-smoke.md`** Vertex section; **`pnpm smoke:vertex`** with optional **`--capture`** fixture bootstrap.
- README **Vertex AI Gemini Usage** under Gemini; compatibility matrix, FAQ, adapter guide JSONL boundary, edge-case provenance, integration cookbook Node row, examples index, `.env.example` Vertex vars.
- Tests **LSA-GV01**–**LSA-GV128**, **LSA-GV102b**–**GV102c**, **LSA-DOC75**–**LSA-DOC88**, **LSA-INT48**–**LSA-INT51**, **LSA-REL26**–**LSA-REL27**, **LSA-MAINT21**, **LSA-ST20**, **LSA-X64**; dedicated **vertex golden**, **parseChunk**, **extended edge**, **conformance**, and **google-ai parity** suites.

### Changed

- **`geminiAdapter()`** — `parseChunk` and `parseResponse` honor **`apiSurface: "vertex"`** before candidate/tool mapping; default remains Google AI SSE payloads.
- **`docs/compatibility.md`** — Gemini row covers Vertex via `apiSurface`; Vertex JSONL / envelope quirk documented (no longer deferred).
- **`docs/adapter-guide.md`** — Vertex decode boundary, `normalizeVertexChunk`, NDJSON/JSONL transport row.
- **`docs/post-1.0-provider-roadmap.md`** — Vertex AI Gemini **1.5.5** marked shipped in release sequence; Gemini tier notes updated.
- **`pnpm verify`** — includes **`fixtures:check-gemini`** after unit tests.
- **Architecture diagrams** — `pipeline`, `quick-decision`, `chunk-assembly`, `assembler-lifecycle`, and `transforms` mermaid/SVG sources now show Vertex JSONL decode (`read-chunk-stream.ts`) and `apiSurface: "vertex"` alongside Bedrock EventStream; `docs/img/README.md`, **`docs/performance.md`**, and **`docs/comparison.md`** status labels aligned to **1.5.5**.
- Version labels **1.5.6** across docs; README test badge **1555**.

### Notes

- **Extended Vertex edge cases (GV105–GV128):** mirror Google AI G59–G67 on `apiSurface: "vertex"` — grounding/citation metadata, skipped code parts, malformed tool finish, non-zero choice index, post-finish assembler drops, google-ai vs vertex wrapper isolation, tool id reconciliation, jsonMode assembly, envelope forward-compat.
- **Google AI vs Vertex:** same unified mapping once envelopes are stripped; Vertex HTTP streams are often **JSONL or concatenated JSON objects**, not `data:` SSE — split lines in your app (see `examples/vertex/read-chunk-stream.ts`) then feed one JSON string per `parseChunk`.
- **Auth:** Vertex uses **ADC bearer tokens** (`VERTEX_ACCESS_TOKEN` / `gcloud auth print-access-token`), not `GOOGLE_API_KEY` on the Vertex host.
- **Deferred:** Gemini **Interactions API**; multimodal `inlineData` / `fileData` parts; dedicated **`citation.*`** / grounding unified events (grounding fields remain in **`metadata.raw`** in 1.x).
- **Fixture capture:** `pnpm smoke:vertex --capture` writes jsonl lines for maintainer review — redact before commit; prefer synthetic fixtures for CI.

## [1.5.0]

### Added

- **`cohereAdapter()`** — Cohere Chat **v2** SSE event types (`message-start`, `content-delta`, `tool-plan-delta`, `tool-call-*`, `citation-start`, `message-end`) → unified `StreamEvent`s; `CohereAdapterOptions` with `jsonMode`.
- **`llm-stream-assemble/adapters/cohere`** subpath export.
- **`test/fixtures/cohere/`** — docs-shaped synthetic v2 `.jsonl` / `.sse` / `.json` fixtures (text, tools, tool-plan, citations, json-mode, errors, usage, incomplete, non-stream responses).
- **`examples/node-fetch/cohere.ts`** — `https://api.cohere.com/v2/chat` streaming via `assembleStream` + `cohereAdapter`.
- **`examples/integrations/cohere-proxy.ts`** — Cloudflare Worker / edge proxy for Cohere Chat v2 SSE (not OpenAI-compatible).
- **`scripts/live-smoke/cohere-chat.mjs`** + **`docs/live-smoke.md`** Cohere v2 section; `pnpm smoke:cohere` with optional `--capture` fixture bootstrap and `COHERE_SMOKE_TOOLS=1`.
- README **Cohere Usage** (seventh built-in adapter); compatibility matrix, FAQ, adapter guide, edge-case provenance, examples index, architecture diagrams.
- Tests **LSA-CO01**–**LSA-CO98**, **LSA-DOC65**–**LSA-DOC74**, **LSA-INT42**–**LSA-INT47**, **LSA-P09**, **LSA-REL23**–**LSA-REL25**, **LSA-MAINT20**, **LSA-ST19**, **LSA-X63**; dedicated **finish/usage**, **tools**, **conformance**, **edge cases**, and **docs regression** Cohere suites mirroring Bedrock depth.

### Changed

- **Seventh built-in adapter** — `cohereAdapter()` joins OpenAI Chat, compatible, Anthropic, Responses, Gemini, and Bedrock; not OpenAI-compatible (dedicated parser required).
- **`docs/adapter-guide.md`** — Cohere v2 SSE event mapping; factory table row; distinction from `openaiCompatibleAdapter`.
- **`docs/img/`** — `cohereAdapter` nodes in `adapters-overview`, `pipeline`, `quick-decision`, `chunk-assembly`, `assembler-lifecycle`, and `transforms` (SVG regenerated); stable label **1.5.0**.
- **`docs/post-1.0-provider-roadmap.md`** — Cohere **1.5.0** marked shipped.
- Version labels **1.5.0** across docs; README test badge **1316**.

### Notes

- Cohere v2 only — legacy v1 chat endpoints are out of scope.
- **`tool-plan-delta`** maps to `reasoning.*` with `variant: "detail"`; citations map to **`metadata.raw`** (no dedicated `citation.*` events in 1.x).
- **Late tool id:** when `tool-call-start` omits `id`, adapter emits `tool_call.start` with placeholder `cohere:tool:{index}`; reconciles to the real id on `tool-call-delta`. Assembler may emit a closing `tool_call.done` for the placeholder id at stream end — see `test/fixtures/cohere/tool-late-id.jsonl` (**LSA-CO77**, **LSA-CO78**).
- Use **`assembleStream(response.body, cohereAdapter())`** — core `parseSSE()` handles SSE framing; do not use `openaiCompatibleAdapter` for Cohere.

## [1.4.1]

### Added

- **`src/adapters/shared/`** — internal SSOT helpers: `parseAdapterObjectPayload`, `incrementalJsonStringDelta`, `mapAnthropicLikeStopReason`, `buildUsageChunk`, `textOrJsonDelta`, `anthropicBlockStartChunks`.
- **`src/core/utils/object.ts`** — `stripUndefined()` shared by assembler and adapter optional chunk builders.
- Extended edge-case suites: **`shared-adapters`**, **`anthropic-conformance`**, **`anthropic-finish-usage`**, **`openai-responses-conformance`**, **`openai-responses-edge-cases`**, **`openai-responses-finish-usage`**, **`openai-chat-edge-cases`**, **`cross-adapter-assembler-edge`**; expanded **anthropic** / **gemini** edge cases.
- Tests **LSA-SH01**–**SH10**, **LSA-A26**–**A41**, **LSA-R32**–**R44**, **LSA-OC229**–**OC233**, **LSA-X58**–**X62**, **LSA-G64**–**G67**.

### Changed

- **Gemini, Bedrock, Anthropic, OpenAI Responses, OpenAI Chat** — refactored to shared parse/usage/stop-reason/incremental-json helpers; unified scoped parse errors (`scope: expected a JSON object`).
- **Anthropic** — trim / `[DONE]` / whitespace lines; provider errors preserve `.raw`; response blocks share stream block mapper.
- **Bedrock `parseResponse`** — synthesizes ConverseStream events through stream parser (DRY with stream mode).
- **OpenAI Responses** — removed dead tool `aliases` map; empty/`[DONE]` via shared parse preamble.
- **`AnthropicAdapterOptions`** exported from `adapters/index.ts`.
- Docs **adapter-guide** shared internals section; version labels **1.4.1**; README test badge **1183**.

### Fixed

- OpenAI Chat empty SSE payload lines no longer throw JSON parse errors.

## [1.4.0]

### Added

- **`bedrockAdapter()`** — AWS Bedrock ConverseStream decoded JSON events → unified `StreamEvent`s; `BedrockAdapterOptions` with `modelFamily` (`anthropic` | `openai-like` | `nova` | `auto`) and `jsonMode`.
- **`llm-stream-assemble/adapters/bedrock`** subpath export.
- **`test/fixtures/bedrock/`** — synthetic ConverseStream jsonl/sse/bin/response fixtures; guardrail and EventStream bytes fixtures.
- **`examples/bedrock/decode-event-stream.ts`** — minimal zero-dep EventStream decode helper (examples only); **`event-stream-bytes.bin`** fixture.
- **`examples/integrations/bedrock-worker-proxy.ts`** — Cloudflare Worker + Bedrock ConverseStream proxy recipe.
- **`examples/node-fetch/bedrock.ts`** and **`examples/bedrock/README.md`** — decode boundary documentation.
- **`scripts/live-smoke/bedrock-converse.mjs`** + **`docs/live-smoke.md`** Bedrock section; `pnpm smoke:bedrock`.
- README **Bedrock Usage**; integration cookbook + compatibility guardrail quirks.
- Tests **LSA-B01**–**B81**, **LSA-DOC51**–**DOC59**, **LSA-INT39**–**INT41**, **LSA-P08**, **LSA-X56**/**X57**, **LSA-REL20**–**REL22**, **LSA-MAINT18**; dedicated **finish/usage**, **tools**, and **conformance** Bedrock suites mirroring Gemini depth.

### Changed

- **`docs/adapter-guide.md`** — Bedrock decode boundary; sixth dedicated reference adapter.
- **`docs/img/adapters-overview`** — `bedrockAdapter` node; stable **1.4.0** label.
- **`docs/img/`** — Bedrock decode branches in `pipeline`, `quick-decision`, `chunk-assembly`, `assembler-lifecycle`, and `transforms` diagrams (SVG regenerated).
- Version labels **1.4.0** across docs; README test badge **1124**.
- **`.env.example`** — `AWS_REGION`, `BEDROCK_MODEL_ID`, credential placeholders.
- **`docs/integration-cookbook.md`** — Bedrock Worker decision row.

### Notes

- Binary AWS EventStream framing is **not** parsed by this library — decode before `parseChunk`.
- IAM, signing, and retries remain application concerns.

## [1.3.6]

### Added

- **`docs/integration-cookbook.md`** — Hono, Express, Cloudflare Worker proxy, LiteLLM, Next.js App Route, `collectStream`, `createAssemblyTransform`, Vercel AI SDK mapping, LangChain callbacks, offline replay mapper; **Edge cases & failure modes** table with runtime notes (Edge vs Node).
- **`examples/integrations/`** — ten self-contained integration examples (six core stack recipes plus §17: `collect-stream-handler`, `assembly-transform-pipeline`, `nextjs-app-route`, `replay-integration-mapper`) with injected `fetchImpl` and offline CI tests.
- README **Integration cookbook** teaser and Documentation link.
- FAQ integration question linking to **`docs/integration-cookbook.md`**.
- **`.env.example`** — `LITELLM_*` vars with `OPENAI_COMPATIBLE_*` fallback note.
- Tests **LSA-INT01**–**INT38** (`integration-cookbook.test.ts`, `integration-cookbook-edge.test.ts`), **LSA-DOC35**–**DOC50**, **LSA-X52**–**X55**; extended **LSA-X21** / **LSA-X26** / **LSA-X38**.

### Changed

- **`examples/README.md`** — When to use which example + Integrations section listing all ten integration files.
- Version labels **1.3.6** across docs and diagrams; **LSA-DOC16**, **LSA-OC84**/**107**/**135**/**165**; README test badge **1019+**.

## [1.3.5]

### Added

- **`docs/edge-cases.md`** — SSE mid-line split, tool JSON partials, JSON mode streaming, UI/markdown fence non-goal, DIY vs `assembleStream` table, `assembleFromFile` fixture replay, and fixture/test provenance table.
- README **Edge-case showcase** teaser with **`docs/img/chunk-assembly.svg`** mental model diagram.
- README **First success in 30 seconds** — minimal `assembleStream` loop using real exports (no fictional `StreamAssembler` API).
- README **`### Why not \`text += chunk\`?`** — explicit skeptic framing with six failure modes.
- README **Performance at a glance** under Why use this — zero deps, incremental SSE, O(n) assembly, bounded buffers, `pnpm bench:smoke`.
- README hero line — “not another `+=` loop” positioning.
- FAQ entry linking to **`docs/edge-cases.md`**.

### Changed

- README Contents section order (Edge-case showcase, First success anchors); version labels **1.3.5** across docs and diagrams.
- **`scripts/build-diagrams.mjs`** — **`chunk-assembly.mmd`**.
- Docs regression tests **LSA-DOC21**–**DOC34**, **LSA-X51**; **LSA-DOC16** → **1.3.5**; **LSA-OC84**/**107**/**135**/**165** → **1.3.5**; README test badge **961+**.

## [1.3.4]

### Added

- **`docs/performance.md`** — design characteristics (incremental SSE, O(n) assembly, bounded buffers), memory notes, and **`pnpm bench:smoke`** reproduction steps for LSA-C52.
- **`docs/comparison.md`** — positioning vs full-stack AI SDKs, provider SDKs, schema stream parsers, tag parsers, and DIY concatenation; when to use / when not to use.
- **`docs/faq.md`** — ten common questions (lifecycle, proxy safety, JSON mode, Anthropic partial JSON, vs AI SDK, bench script).
- **`scripts/bench-smoke.mjs`** and **`pnpm bench:smoke`** — local LSA-C52 timing script (not a CI gate; requires `pnpm build`).
- README **“Why not just concatenate?”** — eight stream edge cases (SSE splits, tool args, reasoning, JSON mode, lifecycle, errors, dual code path).
- README **quick decision guide** with **`docs/img/quick-decision.svg`** — adapter routing in ~30 seconds.
- README **examples index** (OpenAI, Ollama, Anthropic, JSON mode, tool calling, proxy, replay) with links to `examples/` and Usage guides.
- README **“How this compares”** teaser linking to full comparison doc.
- Architecture **lifecycle & concurrency** prose and **`docs/img/assembler-lifecycle.svg`** (stateful assembler vs stateless adapters/transforms).

### Changed

- README Contents reordered; **`examples/README.md`** headings aligned (OpenAI, Ollama, Anthropic, Streaming JSON, Tool calling, Proxy safety).
- **`docs/adapter-guide.md`** — assembler vs adapter state section; version refs **1.3.4**.
- **`docs/compatibility.md`**, **`docs/img/adapters-overview.mmd`**, and README badges — **1.3.4**.
- **`package.json`** `description` and **`keywords`** — npm/GitHub SEO (ollama, structured-output, stream-assembly, cloudflare-workers, …).
- Docs regression tests **LSA-X42**–**LSA-X50** and **`test/docs-positioning-1.3.4.test.ts`** (**LSA-DOC01**–**DOC20**) edge-case guards; README test badge **946**.

## [1.3.3]

### Added

- **`openai-compatible-resolve.ts`**: `resolveCompatibleAdapterConfig()` and
  `ResolvedCompatibleAdapterConfig` — explicit resolution of preset options before adapter
  construction (re-exported from the compatible adapter module).
- **Strict host matrix** `test/openai-compatible-strict-matrix.test.ts` (**LSA-OC218**–**OC218h**):
  azure strict preset guards mirroring the loose matrix.
- **Preset reasoning matrix** `test/openai-compatible-reasoning-matrix.test.ts` (**LSA-OC219**):
  table-driven `thinking`, `reasoning`, `reasoning_delta`, `reasoning_content`, and
  `reasoning_summary` expectations per preset.
- **Exhaustive compatible suite** `test/openai-compatible-presets-exhaustive.test.ts`
  (**LSA-OC220**–**OC241**, **LSA-OC228**, **LSA-OC231**–**OC233**): finish/usage/refusal/
  multichoice/legacy function_call edges, full **52** host stream `runAdapterGoldenStream`
  conformance loops, tool-stream `openaiChatAdapter` parity for nine host fixtures, missing groq
  `tool-single` golden, unknown delta key matrix, and resolve-config SSOT checks.
- Test helpers: `listHostStreamFixtures`, `listHostResponseFixtures`, `hostFixtureAdapterOptions`,
  extended `compatible-preset-matrix.ts` (`PRESET_REASONING_FIELD_CASES`, parity helpers).
- **LSA-RF27**: `resolveCompatibleAdapterConfig` regression guard.

### Changed

- `openaiCompatibleAdapter()` delegates option resolution to `resolveCompatibleAdapterConfig()`.
- **`test/fixtures/openai-compatible/README.md`**: documents loose matrix (**LSA-OC211**–**OC216**),
  Cloudflare robust (**LSA-OC172**–**OC209**), optional per-host `manifest.json`, and SSOT preset
  module reference — replaces stale **OC170**–**OC210** maintainer wording.
- **`docs/live-smoke.md`** checklist aligned with post-1.3.1 test layout (matrix + robust + SSOT
  guards).
- **`docs/adapter-guide.md`**: maintainer subsection for host golden fixtures and manifest pattern.
- **`docs/post-1.0-provider-roadmap.md`** §10 Cloudflare deliverables list updated to current test ids.
- `loadHostFixtureManifest()` returns `{}` when a host has no manifest (safe for future rollout).
- README test badge **917**; stable **1.3.3**.

### Migration from 1.3.1 to 1.3.3

Documentation, test infrastructure, and `resolveCompatibleAdapterConfig` additive export.
Preset runtime behavior unchanged.

## [1.3.1]

### Added

- **`openai-compatible-presets.ts`**: single source of truth for `OPENAI_COMPATIBLE_PROVIDERS`,
  `HOST_COMPATIBLE_PRESETS`, `LOOSE_HOST_PRESETS`, `STRICT_COMPATIBLE_PRESETS`, `DEFAULT_PRESET`,
  and `PRESET_OVERRIDES` with helpers `isStrictCompatiblePreset()` and `hasPresetOverride()`.
- Cloudflare fixture **`manifest.json`** mapping golden (**LSA-OC142**–**OC147**, **OC169**) and
  conformance (**LSA-OC158**, **OC195**–**OC198**) test ids to stream/response fixtures and
  `adapterOptions`.
- Loose host preset matrix suite `test/openai-compatible-loose-matrix.test.ts`
  (**LSA-OC211**–**LSA-OC216**): parameterized guards for malformed JSON, empty object, loose
  string errors, sparse metadata, reasoning aliases, and unrecognizable payloads across all
  non-strict presets.
- Test helpers `test/helpers/compatible-preset-matrix.ts` for shared matrix assertions.

### Changed

- `openai-compatible.ts` imports preset metadata from the SSOT module and re-exports it publicly
  (including from `src/adapters/index.ts`).
- `scripts/generate-compatible-preset-fixtures.mjs` reads `HOST_COMPATIBLE_PRESETS` from dist
  instead of a hardcoded host list; reads `adapterOptions` from per-host `manifest.json` when present.
- Cloudflare golden and conformance tests are table-driven from `manifest.json` instead of
  seven/eight duplicate `it` blocks.
- Cloudflare robust suite slimmed to Workers-AI-specific behavior; generic loose-preset checks
  moved to the matrix suite.
- **LSA-OC73**, **LSA-OC14c**, **LSA-RF14** use `OPENAI_COMPATIBLE_PROVIDERS` and
  `isStrictCompatiblePreset()` instead of duplicated provider arrays.
- **LSA-OC106** and **LSA-OC134** repurposed from duplicate version guards to SSOT/manifest
  regression checks; **LSA-OC84** remains the canonical package version test.

### Migration from 1.3.0 to 1.3.1

No breaking API changes. Preset constants moved to `openai-compatible-presets.ts` but remain
re-exported from `openaiCompatibleAdapter`'s module path.

## [1.3.0]

### Added

- OpenAI-compatible preset **`cloudflare`** for Cloudflare Workers AI REST
  (`/v1/chat/completions`) with loose defaults like Groq (not strict like `azure`).
- Host golden fixtures under `test/fixtures/openai-compatible/cloudflare/`: text-basic,
  missing-metadata, tool-single, usage-stream, provider-error, json-mode, and
  response-basic.
- Example `examples/workers-ai/rest-chat-completions.ts` with URL builder, Bearer auth,
  and `stream_options.include_usage` on streaming requests.
- Proxy-safety documentation for Cloudflare Workers AI server-side forwarding.
- Live smoke: `pnpm smoke:cloudflare`.
- Tests **LSA-OC142** through **LSA-OC210**, **LSA-RF23** through **LSA-RF26**, **LSA-X36** through **LSA-X41**.
- Dedicated robust regression suite `test/openai-compatible-presets-cloudflare-robust.test.ts`
  (**LSA-OC170**–**LSA-OC210**): loose vs strict overrides, azure contrast, tool/usage/json
  streams, reasoning aliases, conformance golden streams, unicode, and statelessness.
- Extended cross-preset guards: **LSA-OC100**, **LSA-OC110**, **LSA-OC111**, **LSA-OC104** include
  `cloudflare`.

### Changed

- README architecture diagrams and preset tables include `cloudflare`.
- `docs/post-1.0-provider-roadmap.md` §10 Workers AI shipped at `1.3.0`.

### Migration from 1.2.0 to 1.3.0

- New optional preset: `openaiCompatibleAdapter({ provider: "cloudflare" })`.
- No breaking changes.

## [1.2.0]

### Added

- OpenAI-compatible preset **`azure`** for Azure OpenAI Chat Completions with stricter
  defaults aligned to OpenAI Chat semantics (`looseErrorShape: false`,
  `allowMissingMetadata: false`).
- Azure host golden fixtures: content-filter metadata, content-filter block (refusal),
  json-mode stream, usage stream, provider-error, reasoning stream, and non-stream responses.
- Example `examples/node-fetch/azure-openai.ts` with deployment URL builder and `api-key`
  authentication pattern.
- Proxy-safety documentation for Azure OpenAI server-side forwarding.
- Live smoke: `pnpm smoke:azure`.
- Tests **LSA-OC113** through **LSA-OC141**, **LSA-RF21**, **LSA-RF22**, **LSA-X34**, **LSA-X35**.

### Fixed

- `openaiCompatibleAdapter` now applies preset-level `allowMissingMetadata` and
  `looseErrorShape` when the caller does not pass explicit options (required for azure
  strict defaults).
- Strict `looseErrorShape: false` silently ignores loose string `error` payloads instead
  of throwing when `rejectUnrecognizedPayloads` is enabled.

### Changed

- `PRESET_OVERRIDES` supports per-preset `looseErrorShape`, `allowMissingMetadata`, and
  `useChoicePositionFallback`.
- README landing page refresh with architecture, adapter overview, and transforms diagrams.
- `pipeline.mmd` includes Google Gemini; new `adapters-overview.mmd` and `transforms.mmd` sources.
- `pnpm diagrams:build` regenerates committed SVGs for npm-safe README rendering.

### Migration from 1.1.6 to 1.2.0

- New optional preset: `openaiCompatibleAdapter({ provider: "azure" })`.
- No changes required for existing integrations.
- Azure callers should prefer the azure preset over `generic` for stricter error handling
  and documented content-filter metadata behavior.
- Override example: `openaiCompatibleAdapter({ provider: "azure", allowMissingMetadata: true })`
  when a gateway normalizes lossy payloads.

## [1.1.6]

### Added

- OpenAI-compatible presets **`perplexity`** and **`xai`** with host golden fixtures under
  `test/fixtures/openai-compatible/<host>/`.
- Perplexity citation/search metadata preserved in `metadata.raw` (stream + response).
- Perplexity provider-error and xAI reasoning-stream fixtures.
- Examples `examples/node-fetch/perplexity.ts` and `examples/node-fetch/xai.ts`.
- Live smoke: `pnpm smoke:perplexity`, `pnpm smoke:xai` (manual only, not CI).
- Tests **LSA-OC87** through **LSA-OC112**, **LSA-RF20**.

### Migration from 1.1.5 to 1.1.6

- New optional presets: `openaiCompatibleAdapter({ provider: "perplexity" | "xai" })`.
- No changes required for existing integrations.

## [1.1.5]

### Added

- OpenAI-compatible presets **`deepseek`** and **`mistral`** with host-specific golden fixtures
  under `test/fixtures/openai-compatible/<host>/`.
- Formal host preset coverage for **Groq**, **DeepSeek**, **Mistral**, **Ollama**, **LM Studio**,
  **Together**, **Fireworks**, and **OpenRouter** — stream and non-stream (groq, deepseek) golden tests
  **LSA-OC47** through **LSA-OC86**.
- DeepSeek preset maps `reasoning_content` (and related aliases) to unified `reasoning.*` events.
- Cross-preset parity tests (`LSA-OC77`–`LSA-OC79`) ensuring generic vs host-specific reasoning aliases.
- Maintainer script `scripts/generate-compatible-preset-fixtures.mjs` with `--check` drift guard wired into
  `pnpm verify` via `fixtures:check-compatible`.
- Live smoke scripts: `pnpm smoke:ollama`, `pnpm smoke:deepseek` (manual only, not CI).
- Extended `test/helpers/compatible-fixtures.ts` with `hostCompatibleFixture()` and
  `ALL_COMPATIBLE_PROVIDERS` exhaustiveness guard.

### Changed

- `openaiCompatibleAdapter({ provider })` preset table in README and compatibility quirks expanded per host.
- `examples/node-fetch/openai-compatible.ts` accepts `OPENAI_COMPATIBLE_PROVIDER` env (default `generic`).
- `.env.example` documents optional keys for DeepSeek, Mistral, Groq, and Ollama smoke runs.

### Migration from 1.1.0 to 1.1.5

- New optional presets: `openaiCompatibleAdapter({ provider: "deepseek" | "mistral" })`.
- Existing integrations unchanged when using `generic` or prior presets.

## [1.1.0]

### Added

- **Google Gemini adapter** (`geminiAdapter`) for Google AI `streamGenerateContent?alt=sse` and
  non-streaming `generateContent` — maps `candidates[].content.parts[]` to unified text, tool calls,
  reasoning (`thought` parts), JSON mode, usage, finish, and error events.
- Subpath export `llm-stream-assemble/adapters/gemini` with ESM/CJS build artifacts and smoke coverage.
- Synthetic fixtures under `test/fixtures/gemini/` (text, tools, `partialArgs`, thinking, safety,
  blocked prompts, incomplete streams) with golden tests **LSA-G01** through **LSA-G71**.
- Internal adapter conformance helper `test/helpers/adapter-conformance.ts` for shared golden-stream checks.
- Example `examples/node-fetch/gemini.ts`, maintainer live smoke `scripts/live-smoke/gemini.ts`,
  `.env.example`, and [docs/live-smoke.md](./docs/live-smoke.md).
- GitHub issue template `.github/ISSUE_TEMPLATE/new-adapter.md` for community adapter proposals.

### Changed

- README adds **Gemini Usage** section; compatibility matrix and adapter guide document Gemini support,
  quirks (`partialArgs`, no `refusal.*`, Vertex deferred), and honest feature flags.
- package.json keywords include `gemini` and `google`.

### Migration from 1.0.x to 1.1.0

- New optional subpath: `llm-stream-assemble/adapters/gemini`.
- No changes required for existing OpenAI, Anthropic, or Responses integrations.

## [1.0.1]

### Added

- Architecture diagram sources and exports under `docs/img/` (`pipeline.mmd`, `stream-event.mmd`,
  and matching SVGs) so README illustrations can be regenerated with `@mermaid-js/mermaid-cli`.

### Changed

- README **How it works** section replaces Mermaid fences with GitHub-hosted SVG images so
  pipeline and `StreamEvent` diagrams render on npmjs.com (npm README does not execute Mermaid).

## [1.0.0]

### Added

- First stable release: core stream assembly, four provider adapters (OpenAI Chat,
  OpenAI-compatible, Anthropic Messages, OpenAI Responses), transforms
  (`collectStream`, `tapEvents`, `toSSE`), Node replay helper (`assembleFromFile`),
  type guards, and documented examples.

### Changed

- README, compatibility matrix, and release-readiness checks now reflect stable
  `1.0.0` status instead of pre-1.0 release candidate wording.
- package.json version bumped to 1.0.0.

### Migration from 0.8.x

- Upgrade through `0.9.0` semantics: remove any imports of `notImplemented` or
  `notImplementedAsyncIterable` — those scaffold exports were removed in 0.9.0.

## [0.9.0]

### Removed

- Public exports `notImplemented` and `notImplementedAsyncIterable` — Phase 0
  scaffold helpers are no longer part of the package API. All core functions,
  adapters, transforms, and type guards are fully implemented; callers should
  not depend on throw-on-use placeholders.

### Changed

- package.json version bumped to 0.9.0 as the first 1.0 API cleanup release.

## [0.8.0]

### Added

- Package smoke test for npm tarball contents and installed ESM/CJS/subpath imports.
- Release-readiness tests LSA-REL01 through LSA-REL13.

### Changed

- Added OpenAI Responses subpath export and build artifact coverage.
- CI now verifies Node 18, 20, and 22.
- README now includes install, quickstart, non-goals, pre-1.0 release candidate
  status, and publish-facing project description.
- Adapter guide and compatibility docs updated for release readiness.
- package.json version bumped to 0.8.0.

## [0.7.1]

### Changed

- Refactored repeated adapter helper logic into internal utilities for safer
  unknown-value narrowing, JSON parsing, optional RawChunk construction, and
  prefixed adapter errors.
- Marked scaffold `notImplemented` helpers as deprecated internal implementation
  details while preserving compatibility.
- Added internal adapter utility tests and bundle/build regression checks to guard
  the maintenance refactor.

### Fixed

- Removed stale documentation wording that implied implemented adapters were still
  scaffold stubs.

## [0.7.0]

### Added

- OpenAI Responses adapter for streaming event payloads and non-streaming response
  objects, including output text, function call item lifecycle, streamed function
  call arguments, usage, failed/incomplete lifecycle events, JSON mode, best-effort
  string reasoning fields, and provider errors.
- OpenAI Responses fixtures under `test/fixtures/openai-responses/` and tests
  LSA-R01 through LSA-R41.

### Changed

- README and compatibility docs document OpenAI Responses support and limitations.
- docs/adapter-guide.md notes that OpenAI Responses uses event-name-driven parsing
  instead of Chat-style choice deltas.
- package.json version bumped to 0.7.0.

## [0.6.0]

### Added

- Node fetch examples for OpenAI Chat, OpenAI-compatible providers, Anthropic
  Messages, and local fixture replay.
- Web-standard proxy safety examples showing `tapEvents` for server-side logging
  and `toSSE(..., { sanitizeErrors: true })` for browser-facing streams.
- Browser-side data-only unified SSE reader example for proxy responses.
- Example tests LSA-X01 through LSA-X33 using fake fetch responses and checked-in
  fixtures, with no live provider calls.

### Changed

- README links examples and documents proxy safety guidance.
- examples/README.md documents manual usage, environment variables, and CI-safe
  injected fetch testing.
- examples/proxy-safety/README.md documents sanitization, log redaction, request
  schema validation, CORS guidance, and browser SSE consumption.
- package.json version bumped to 0.6.0.

## [0.5.0]

### Added

- `collectStream()` to materialize text, reasoning, refusals, JSON, tool calls,
  latest usage, and finish reason from a StreamEvent iterable.
- `tapEvents()` to observe StreamEvents without changing the stream.
- `toSSE()` to serialize unified StreamEvents to a Web ReadableStream of SSE
  bytes, with safe error serialization and `sanitizeErrors` support. Phase 5
  intentionally emits data-only SSE without named `event:` fields.
- `assembleFromFile()` for local/dev replay of `.sse` and `.json` fixtures.
- Transform and replay tests LSA-T01 through LSA-T42 plus edge-case subcases.

### Changed

- README documents collection, tapping, unified SSE forwarding, and fixture replay.
- README documents collectStream memory behavior and the Node-only/browser bundling
  note for assembleFromFile.
- docs/adapter-guide.md references replay helpers for adapter development.
- docs/compatibility.md notes that convenience transforms are provider-agnostic.
- package.json version bumped to 0.5.0.

## [0.4.0]

### Added

- Anthropic Messages adapter for streaming SSE payloads: message lifecycle,
  text blocks, thinking blocks, tool_use blocks with fine-grained input JSON
  deltas, refusal blocks, usage, finish reasons, provider errors, and JSON mode.
- `anthropicAdapter().parseResponse` for non-streaming Anthropic Messages
  responses using the same RawChunk pipeline as streaming.
- Anthropic fixtures under `test/fixtures/anthropic/`, fixture provenance docs,
  and detailed LSA-A01 through LSA-A25 coverage.

### Changed

- README status and usage docs now include Anthropic Messages adapter usage and
  fine-grained tool input streaming notes.
- docs/compatibility.md marks Anthropic Messages as supported and documents
  Anthropic-specific streaming/tool-use notes.
- docs/adapter-guide.md includes Anthropic-specific edge cases for content block
  streams and fine-grained tool input.
- package.json version bumped to 0.4.0.

## [0.3.0]

### Added

- OpenAI-compatible adapter for OpenAI-shaped Chat Completions APIs, reusing the
  OpenAI Chat parser with provider presets and dialect options.
- Dialect handling for missing metadata, missing choice indexes, missing tool ids,
  loose provider error shapes, reasoning aliases, usage token aliases, and JSON
  mode.
- OpenAI-compatible fixtures under `test/fixtures/openai-compatible/`, fixture
  provenance docs, and tests LSA-OC01 through LSA-OC46.

### Changed

- Shared OpenAI Chat parsing internals so OpenAI-compatible behavior stays
  aligned with the canonical OpenAI adapter.
- README and compatibility docs document OpenAI-compatible support, provider
  presets, strict vs loose configuration, and known limitations.
- package.json version bumped to 0.3.0.

## [0.2.0]

### Added

- OpenAI Chat Completions adapter for streaming SSE payloads: text, tool calls,
  legacy function_call, refusal, reasoning, usage, finish reasons, provider
  errors, JSON mode via adapter option, and multi-choice `choiceIndex`.
- `openaiChatAdapter().parseResponse` for non-streaming Chat Completions JSON
  using the same RawChunk pipeline as streaming.
- OpenAI Chat golden fixtures under `test/fixtures/openai-chat/`, fixture
  provenance docs, and detailed LSA-O01 through LSA-O53 coverage.

### Changed

- README status and usage examples now include OpenAI Chat adapter usage, adapter
  instance lifecycle guidance, streaming usage notes, and JSON mode guidance.
- docs/compatibility.md marks OpenAI Chat Completions as supported and documents
  OpenAI-specific notes for usage, JSON mode, and legacy function_call.
- docs/adapter-guide.md points future adapter authors at OpenAI Chat as the first
  concrete reference adapter.
- package.json version bumped to 0.2.0.

## [0.1.1]

### Fixed

- GitHub Actions CI now lets `pnpm/action-setup` read the package manager version
  from `package.json` instead of also specifying `version: 9` in the workflow.
  This avoids the action's multiple-version error and keeps `pnpm@9.15.9` as the
  single source of truth.

## [0.1.0]

### Added

- Core SSE parser (`parseSSE`) with UTF-8 streaming decode, multiline `data:`
  support, `[DONE]` terminal marker handling, CRLF support, comment skipping, and
  split-chunk recovery.
- Partial JSON parser (`parsePartialJSON`) for live previews of incomplete JSON
  fragments used by structured output and tool-call argument streams.
- Event assembler state machine for text, reasoning, refusal, structured JSON,
  parallel tool calls, index-based tool reconciliation, metadata, usage, finish,
  and provider error events.
- Streaming entry points: `assembleFromPayloads`, `assembleStream`, and
  `createAssemblyTransform`.
- Non-streaming entry point: `assembleResponse` with `adapter.parseResponse`
  support so stream and non-stream paths share the same event model.
- Abort and lifecycle handling: `finish.reason: "aborted"` for `AbortSignal`,
  `finish.reason: "incomplete"` for truncated streams, and clean `[DONE]`
  mapping to `finish.reason: "stop"`.
- `maxBufferBytes` option to cap accumulated text, reasoning, refusal, JSON, and
  tool-call argument buffers without silently truncating output.
- Core golden fixtures under `test/fixtures/core/`, mock test adapters, and
  detailed LSA-C01 through LSA-C52 coverage including cleanup and performance
  smoke tests.

### Changed

- Core function stubs now have real implementations; provider adapter parsing,
  `collectStream`, `toSSE`, `tapEvents`, and `assembleFromFile` remain planned
  stubs for later phases.
- Stub and scaffold tests now reflect the implemented core behavior while keeping
  adapter and transform stub boundaries explicit.
- README status updated for Phase 1 with badges, core usage notes, and memory
  buffering guidance.
- package.json version bumped to 0.1.0.

## [0.0.5]

### Added

- Comprehensive Phase 0 edge-case tests:
  - LSA-G01…G17 — all 16 type guards (positive, negative, mutual exclusivity).
  - LSA-M01…M19 — matchEvent dispatch for every StreamEvent type, finish reason
    variants, and missing-handler behavior.
  - LSA-ST01…ST15 — all core/transform/adapter stubs throw not-implemented.
  - LSA-P01…P05 — subpath dist exports (root, core, all adapters).
  - LSA-B01…B10 — build artifact presence (ESM, CJS, declarations).
  - LSA-E01…E02 — expanded export surface assertions (16 type guards).
- test/fixtures/sample-events.ts — sample events with unicode, choiceIndex, variants,
  partial tool args, and all finish reasons.

### Changed

- pnpm verify and GitHub CI now run build before tests so dist artifact tests are
  reliable on clean checkouts.
- CI workflow simplified to a single `pnpm verify` step.

## [0.0.4]

### Added

- Author metadata: Ladislav Kostolny <01laky@gmail.com> in package.json, LICENSE,
  README (Author section), and CONTRIBUTING (Maintainer).

### Changed

- Prettier format pass across source, tests, and documentation (no logic changes).

## [0.0.3]

### Added

- TypeScript project scaffold: tsup (ESM + CJS + declarations), Vitest, ESLint,
  Prettier, strict tsconfig.
- Full public API surface as typed stubs matching docs/proposal.md — core,
  adapters, transforms, helpers (type guards and matchEvent implemented).
- Subpath exports: llm-stream-assemble/core, adapters/openai-chat,
  adapters/openai-compatible, adapters/anthropic.
- CI workflow (lint, typecheck, test, build, zero-deps verify).
- scripts/verify-zero-deps.mjs — fails if runtime dependencies are added.
- LICENSE (MIT), CONTRIBUTING.md, docs/compatibility.md, docs/adapter-guide.md
  skeletons.
- Smoke tests LSA-S01 through LSA-S10 and exports.test.ts.

### Changed

- README: status, scripts, documentation links.
- package.json: build scripts, exports map, devDependencies; version 0.0.3.

## [0.0.2]

### Changed

- `prompts/` is now gitignored — implementation prompts are maintained locally
  only and are no longer tracked or pushed to GitHub.
- README updated to document the local-only prompts workflow; canonical project
  spec remains in `docs/proposal.md`.

### Removed

- Tracked `prompts/README.md` removed from the repository index (files stay on
  disk locally if present).

## [0.0.1]

### Added

- Product and technical proposal in `docs/proposal.md`: defines the library scope
  (stream assembly only — no HTTP client, agent loop, or UI), unified `StreamEvent`
  model, provider adapter plan (OpenAI Chat, Anthropic Messages), v0.1/v0.2 roadmap,
  testing strategy, and publishing criteria.
- Root `README.md` with project positioning and links to documentation.
- `prompts/` directory placeholder for future incremental implementation prompts;
  canonical spec remains in `docs/proposal.md`.
- Cursor project rules under `.cursor/rules/`: no AI co-author in git, detailed
  CHANGELOG and semver after each completed part, long descriptive commit messages.
- `package.json` at `0.0.1` with repository metadata, description, and keywords
  aligned with the planned npm package identity.
