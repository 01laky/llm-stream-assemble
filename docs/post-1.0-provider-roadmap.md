# Post-1.0 Provider Roadmap — Proposal

**Status:** Proposal (not yet scheduled)  
**Baseline release:** `1.0.0`  
**Audience:** maintainers, adapter authors, contributors  
**Last updated:** 2026-05-26 (proposal-2)

> This document describes planned work **after** the stable `1.0.0` release. It is a
> forward-looking proposal only — nothing here is committed to a release date or
> final API shape until implemented, tested, and documented in `CHANGELOG.md`.
>
> For current shipped adapters, see [`compatibility.md`](./compatibility.md).  
> For how to implement adapters, see [`adapter-guide.md`](./adapter-guide.md).

---

## Summary

`llm-stream-assemble` reached `1.0.0` with four production adapters:

- OpenAI Chat Completions (`openaiChatAdapter`)
- OpenAI-compatible hosts (`openaiCompatibleAdapter`)
- Anthropic Messages (`anthropicAdapter`)
- OpenAI Responses (`openaiResponsesAdapter`)

The natural next phase is **provider expansion without breaking the stable core**.
New adapters and dialect presets should ship as **minor semver releases** (`1.1.0`,
`1.2.0`, …) while the unified `StreamEvent` model and public transform APIs remain
backward compatible unless a deliberate major is justified.

This proposal prioritizes providers by **user impact**, **format divergence**
(whether a dedicated parser is required), and **fixture availability**, and
explicitly excludes work that belongs in application code (HTTP clients, auth,
retries, agent loops, UI).

---

## Guiding principles

### Semver after 1.0

| Change type                             | Example                | Version bump        |
| --------------------------------------- | ---------------------- | ------------------- |
| New adapter subpath export              | `geminiAdapter()`      | **minor** (`1.1.0`) |
| New compatible preset / dialect option  | `provider: "groq"`     | **minor**           |
| Additional fixtures / golden tests only | LSA-G\* fixtures       | **patch**           |
| Bug fix in existing adapter mapping     | tool id reconciliation | **patch**           |
| Remove or rename public export          | drop deprecated helper | **major** (`2.0.0`) |
| Breaking `StreamEvent` shape change     | new required field     | **major**           |

### Adapter contract (unchanged from 1.0)

Every new provider integration must:

1. Implement `StreamAdapter.parseChunk(raw: string): RawChunk[]` for one SSE/JSONL payload.
2. Optionally implement `parseResponse(body: unknown): RawChunk[]` for non-streaming JSON.
3. **Not** perform cross-chunk assembly — that remains in `EventAssembler`.
4. Remain **zero runtime dependencies** — no provider SDK in adapter code.
5. Ship redacted fixtures under `test/fixtures/<adapter-name>/` and golden tests.
6. Update [`compatibility.md`](./compatibility.md) with honest feature flags.

### Non-goals (still out of scope post-1.0)

The following are **not** planned adapter work for this roadmap:

- HTTP client, authentication, retries, rate-limit handling, or API key management.
- Agent orchestration, tool execution, memory, persistence, or RAG pipelines.
- React hooks, UI components, or browser-specific streaming wrappers.
- Multimodal **binary** parsing (audio chunks, image bytes, video frames).
- Realtime WebRTC / websocket binary transports.
- Schema validation of tool arguments or JSON outputs (best-effort partial JSON only).

Proxy and example code may demonstrate these patterns, but they do not belong in
the library core or adapter modules.

### Testing strategy

Each proposed item below includes:

- **Fixture-first development** — synthetic or redacted-live `.sse` / `.json` files.
- **Golden tests** — adapter + assembler → expected `StreamEvent[]`.
- **Docs regression tests** — README / compatibility matrix phrases where applicable.
- **Optional live smoke** — manual or gitignored scripts; CI must not require API keys.

Live smoke is recommended before tagging a minor that introduces a net-new adapter,
but fixture coverage remains the release gate.

---

## Recommended release sequence

This is the suggested order of implementation. Dates are intentionally omitted.

```
1.0.0  ✅  Stable baseline (shipped)
1.1.0  ✅  Google Gemini adapter (first net-new provider)
1.1.5  ✅  OpenAI-compatible preset expansion (Groq, Mistral, DeepSeek, Ollama, …)
1.1.6  ✅  Perplexity + xAI Grok OpenAI-compatible presets
1.2.0  ✅  Azure OpenAI Chat Completions compatible preset (`azure`)
1.3.0  ✅  Cloudflare Workers AI OpenAI-compatible preset (`cloudflare`)
1.4.0      AWS Bedrock adapter (enterprise path deferred from 1.2)
1.5.0      Cohere adapter (if demand exists)
1.x.x      AI21, watsonx / additional compatible dialects as patches or preset bundles
```

Parallel work is possible (e.g. presets while Gemini is in review), but **each
adapter should land with its own CHANGELOG minor section and version bump** rather
than batching unrelated parsers into one release.

---

## Tier 1 — High impact, recommended first

### 1. Google Gemini (`geminiAdapter`)

**Target version:** `1.1.0`  
**Priority:** Highest — already listed as **TBD** in the compatibility matrix; large
user base; **non-trivial stream format** (not fully covered by OpenAI-compatible).

#### Why a dedicated adapter

Gemini streaming uses Google-specific SSE/JSON event shapes (candidate/content parts,
function calls, thought signatures in newer models, usage metadata fields that differ
from OpenAI). Relying on `openaiCompatibleAdapter` would miss events, mis-map tools,
or silently drop usage and safety metadata.

#### API surfaces to support (initial scope)

| Surface                            | Endpoint (typical)                                            | Streaming | Non-streaming |
| ---------------------------------- | ------------------------------------------------------------- | --------- | ------------- |
| Gemini API (AI Studio / Google AI) | `generativelanguage.googleapis.com` … `streamGenerateContent` | yes       | yes           |
| Vertex AI Gemini (future phase)    | `{region}-aiplatform.googleapis.com` …                        | yes       | yes           |

**Proposal:** Implement **Google AI Gemini API** first in `1.1.0`. Defer Vertex-specific
envelope/auth quirks to a later minor (`1.3.0+`) unless fixtures prove the stream payloads
are byte-identical.

#### Event mapping (proposed)

| Gemini concept                                          | Unified mapping                                                                       |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Model / response metadata                               | `metadata`, `message.start`                                                           |
| Text parts (`text` delta)                               | `text.delta` / `text.done`                                                            |
| `functionCall` / tool calls                             | `tool_call.start`, `tool_call.args.delta`, `tool_call.done`                           |
| JSON / structured output mode                           | `json.delta` / `json.done` when `jsonMode: true`                                      |
| “Thought” / internal reasoning fields (model-dependent) | `reasoning.delta` / `reasoning.done` (best-effort)                                    |
| Blocked / safety finish reasons                         | `refusal.*` or `finish` with mapped reason + `error` when provider sends error object |
| Token counts (`usageMetadata`)                          | `usage`                                                                               |
| Stream termination                                      | `finish`                                                                              |

#### Adapter options (proposed)

```ts
export interface GeminiAdapterOptions {
	/** Map structured JSON output streams to json.* instead of text.* */
	jsonMode?: boolean;
	/** Prefix for adapter-thrown parse errors */
	errorPrefix?: string;
}
```

#### Known risks / quirks to fixture

- Parallel function calls and partial argument JSON across chunks.
- Empty candidate lists or missing `candidates[0]` on intermediate chunks.
- Model-specific reasoning/thought fields that appear or disappear by model revision.
- Usage metadata arriving only on the final chunk.
- Provider errors embedded in-stream vs HTTP non-OK bodies.
- Unicode and multi-byte content in text parts.

#### Deliverables checklist

- [x] `src/adapters/gemini.ts` + export in `src/adapters/index.ts`
- [x] Subpath export `./adapters/gemini` in `package.json` + `tsup.config.ts`
- [x] Fixtures: `test/fixtures/gemini/` (text, tool, json-mode, usage, error, incomplete)
- [x] Tests: `LSA-G01` … `LSA-G71` (golden stream, parseChunk unit, response parity, edge cases)
- [x] Example: `examples/node-fetch/gemini.ts`
- [x] Compatibility matrix row update
- [x] Live smoke script: `scripts/live-smoke/gemini.ts` + `docs/live-smoke.md`

#### Success criteria

- Golden tests green without live API keys in CI.
- Manual live smoke (when keys available) produces the same event **types** as fixtures
  for a short text prompt and a single-tool call prompt.

---

### 2. Mistral (`openaiCompatibleAdapter` preset + optional dialect)

**Target version:** `1.1.5` (shipped preset bundle)  
**Priority:** High for European deployments; **low implementation cost** if stream stays OpenAI-shaped.

#### Approach

Prefer extending `openaiCompatibleAdapter({ provider: "mistral" })` rather than a
standalone adapter unless fixtures prove incompatible event shapes.

#### Deliverables checklist

- [x] `provider: "mistral"` preset + host fixtures under `test/fixtures/openai-compatible/mistral/`
- [x] Golden tests **LSA-OC53**–**LSA-OC54**; docs quirks row
- [x] README preset table + base URL

#### Work items

- Document official base URL and auth header pattern in examples.
- Capture fixtures for:
  - plain text streaming;
  - parallel tool calls;
  - reasoning/thinking fields if exposed by Mistral models;
  - missing metadata (`id`, `created`) tolerance already in compatible adapter.
- Add dialect flags only if required (e.g. alternate usage field names, tool id timing).

#### When to escalate to a dedicated `mistralAdapter`

- If Mistral ships non-OpenAI SSE event names comparable to OpenAI Responses.
- If tool-call lifecycle cannot be mapped to existing `RawChunk` kinds without loss.

---

### 3. Groq, Together, Fireworks (compatible preset expansion)

**Target version:** `1.1.5` (shipped bundled preset release)  
**Priority:** High reach, **lowest cost** — hosts advertise OpenAI-compatible APIs.

#### Approach

Extend `OpenAICompatibleProvider` presets:

| Preset key  | Notes                                                          |
| ----------- | -------------------------------------------------------------- |
| `groq`      | Fast inference; occasional missing usage; tool ids may be late |
| `together`  | Model-dependent dialect drift                                  |
| `fireworks` | Similar to Together; verify tool streaming fixtures            |

#### Deliverables checklist

- [x] Host subfolders `groq/`, `together/`, `fireworks/` with golden fixtures
- [x] Tests **LSA-OC47**–**LSA-OC48**, **LSA-OC59**–**LSA-OC62**
- [x] README / compatibility quirks per host

#### Deliverables

- Fixture directory per host under `test/fixtures/openai-compatible/` (or host-specific subfolders).
- Tests: extend `LSA-OC*` regression suite with preset-specific golden files.
- README / compatibility “Known provider quirks” table rows.
- Example snippet or generalization of `examples/node-fetch/openai-compatible.ts`.

#### Non-goals for this tranche

- No guarantee every model on every host — presets remain **best-effort**, documented as such.

---

### 4. DeepSeek (`openaiCompatibleAdapter` preset + reasoning dialect)

**Target version:** `1.1.5` (shipped with Groq/Mistral/Ollama presets)  
**Priority:** High — widely deployed; **OpenAI-compatible base** with model-specific
reasoning fields (`reasoning_content`, R1-style thinking streams).

#### Approach

Extend `openaiCompatibleAdapter({ provider: "deepseek" })` with dialect options for:

- reasoning/thinking content mapped to `reasoning.*` (reuse existing reasoning alias logic);
- tool-call streaming parity with OpenAI Chat;
- usage field aliases if DeepSeek uses `prompt_tokens` / `completion_tokens` variants.

#### Deliverables checklist

- [x] `provider: "deepseek"` + `reasoning_content` alias in `PRESET_OVERRIDES`
- [x] Host fixtures: text, reasoning, tool, error, non-stream response
- [x] Tests **LSA-OC49**–**LSA-OC52**, **LSA-OC66**, parity **LSA-OC77**
- [x] Live smoke `pnpm smoke:deepseek`

#### Work items

- Fixtures: plain text, tool call, reasoning stream, provider error, missing metadata.
- Golden tests in `LSA-OC*` or dedicated `LSA-DS*` if dialect flags are non-trivial.
- Document official base URL (`api.deepseek.com`) and auth header in examples.

#### When to escalate to a dedicated adapter

- If DeepSeek introduces non-OpenAI SSE event names (Responses-style lifecycle).
- If reasoning and content cannot be separated without loss using existing `RawChunk` kinds.

---

## Tier 2 — Enterprise and secondary providers

### 5. AWS Bedrock (`bedrockAdapter`)

**Target version:** `1.4.0`  
**Priority:** High for AWS-native teams; **medium–high complexity**.

#### Why a dedicated adapter

Bedrock wraps multiple model families (Anthropic Claude, Meta Llama, Mistral, Amazon
Nova, etc.) in AWS-specific invocation and response envelopes. Streaming may use
EventStream encoding or base64-wrapped chunks depending on API version and SDK usage.

The adapter should accept **already-decoded text/JSON payload strings** per `parseChunk`
contract (same as other adapters): the library does not own the AWS SDK or signing.

#### Proposed scope (initial)

| Model family on Bedrock          | Strategy                                                                       |
| -------------------------------- | ------------------------------------------------------------------------------ |
| Anthropic Claude messages        | Reuse mapping rules from `anthropicAdapter` where payload matches Messages API |
| OpenAI-like models (Llama, etc.) | Map via compatible-style choice deltas when envelope matches                   |
| Amazon Nova                      | Dedicated fixture capture; map to unified text/tool events                     |

#### Adapter options (proposed)

```ts
export interface BedrockAdapterOptions {
	/** Hint which model family parser to prefer when envelope is ambiguous */
	modelFamily?: "anthropic" | "openai-like" | "nova" | "auto";
	jsonMode?: boolean;
}
```

#### Risks

- EventStream binary framing must be decoded **before** adapter input — document clearly.
- Model family detection from partial streams may require minimal adapter state.
- IAM/auth/signing stays outside the library.

#### Deliverables

- `src/adapters/bedrock.ts`, fixtures, `LSA-B*` tests, compatibility row, example with
  pseudo-upstream decode step.

---

### 6. Azure OpenAI (`azureOpenAIAdapter` or compatible preset)

**Target version:** `1.2.0` (shipped)  
**Priority:** High for Microsoft/Azure shops; **medium complexity**.

#### Approach decision tree

1. If Azure Chat Completions stream payloads are **byte-identical** to OpenAI Chat aside
   from URL/query parameters → extend `openaiChatAdapter` or compatible adapter with
   `azure` preset (deployment name, `api-version` query param documentation only). **Shipped in 1.2.0.**
2. If Azure OpenAI Responses or Assistants streams diverge → dedicated parser module
   reusing shared internals from `openai-chat/parser.ts` and `openai-responses.ts`.

#### Deliverables checklist

- [x] Preset `azure` with stricter defaults and host golden fixtures (text, content filter, json-mode, tools, usage, reasoning, provider-error, responses)
- [x] Tests **LSA-OC113**–**LSA-OC141**, **LSA-RF21**, **LSA-RF22**; parity **LSA-OC127**–**LSA-OC129**, **LSA-OC139**
- [x] Example `examples/node-fetch/azure-openai.ts`; live smoke `pnpm smoke:azure`
- [x] Proxy-safety docs for `api-key` forwarding and deployment URL pattern

#### Work items (remaining / deferred)

- Azure OpenAI Responses streaming (if divergent from OpenAI Responses) — future minor.

---

### 7. Cohere (`cohereAdapter`)

**Target version:** `1.5.0`  
**Priority:** Medium — smaller ecosystem but distinct streaming format.

#### Mapping notes

- Cohere chat/stream APIs use their own event types (text generation, tool calls, citations).
- Citations may map to `metadata` or a future `citation.*` extension — **proposal:**
  defer citation-specific events unless `StreamEvent` union is extended in a minor with
  clear backward compatibility (new event types are additive and safe in 1.x).

#### Initial scope

- Text streaming
- Tool calls (if supported in chosen API version)
- Usage / finish / error

---

### 8. xAI Grok (`openaiCompatibleAdapter` preset)

**Target version:** `1.1.6` (shipped)  
**Priority:** Medium — typically OpenAI-compatible with minor drift.

Same playbook as Groq/Together: fixtures first, preset second, dedicated adapter only if
proven necessary.

#### Deliverables checklist

- [x] Preset `xai` with host golden fixtures (text, tools, reasoning, response)
- [x] Tests **LSA-OC91**–**LSA-OC94**, **LSA-OC109**; parity **LSA-OC111**
- [x] Example `examples/node-fetch/xai.ts`; live smoke `pnpm smoke:xai`

---

### 9. Perplexity (`openaiCompatibleAdapter` preset)

**Target version:** `1.1.6` (shipped)  
**Priority:** Medium — search-augmented answers; API often OpenAI-compatible with extra
metadata and citation-like fields.

#### Approach

- Preset `perplexity` with fixtures for streaming text and optional search/citation metadata.
- Map citation payloads to `metadata.raw` in 1.x unless a dedicated `citation.*` event
  type is approved as an additive `StreamEvent` extension.
- Document that model list and response shape may change independently of this library.

#### Deliverables checklist

- [x] Preset `perplexity` with citations-stream, provider-error, and response fixtures
- [x] Tests **LSA-OC87**–**LSA-OC90**, **LSA-OC99**, **LSA-RF20**; citations via `metadata.raw`
- [x] Example `examples/node-fetch/perplexity.ts`; live smoke `pnpm smoke:perplexity`

---

### 10. Cloudflare Workers AI (`openaiCompatibleAdapter` preset)

**Target version:** `1.3.0` (shipped)  
**Priority:** Medium for edge deployments — OpenAI-compatible REST with Workers-specific
hosting patterns.

#### Deliverables checklist

- [x] Preset `cloudflare` with DEFAULT_PRESET (loose, not strict like azure)
- [x] Fixtures under `test/fixtures/openai-compatible/cloudflare/` (text, tools, usage,
      json-mode, provider-error, response)
- [x] Tests **LSA-OC142**–**LSA-OC210**, **LSA-RF23**–**LSA-RF26**, **LSA-X36**–**LSA-X41**; cross guards **OC100/104/110/111**
- [x] Example `examples/workers-ai/rest-chat-completions.ts`; live smoke `pnpm smoke:cloudflare`
- [x] Document `@cf/` model naming and account binding stays outside the adapter

---

### 11. IBM watsonx / AI21 (evaluate after Tier 1)

**Target version:** `1.x` patch or minor preset bundle — **only if user demand or sponsor fixtures exist**  
**Priority:** Low — enterprise niche; formats vary by deployment.

#### Approach

- Issue-driven: require contributor-supplied redacted fixtures before any preset ships.
- Prefer compatible adapter if stream matches OpenAI Chat; otherwise defer dedicated adapter.

---

## Tier 3 — Ecosystem conveniences (not new parsers)

### 12. Ollama (formal preset + docs + live smoke)

**Target version:** `1.1.5` (shipped)  
**Priority:** High for **free local validation** of live streaming without cloud billing.

Ollama already works through `openaiCompatibleAdapter({ provider: "generic" })` against
`http://localhost:11434/v1/chat/completions`. Formalization work:

#### Deliverables checklist

- [x] `provider: "ollama"` preset with host golden fixtures
- [x] Live smoke `pnpm smoke:ollama`
- [x] Document model pull / startup in `examples/README.md` and `docs/live-smoke.md`

- Add `provider: "ollama"` preset with documented defaults.
- Fixtures for local streaming quirks (missing ids, slow tool args).
- Example + playground preset (local-only, gitignored).
- Document model pull / startup in `examples/README.md`.

This is **not** a new adapter unless Ollama diverges from OpenAI shape in practice.

---

### 13. OpenRouter (preset + dialect documentation)

**Target version:** `1.1.5` (shipped)  
**Priority:** Medium — aggregation layer, not a model provider.

#### Deliverables checklist

- [x] Host fixtures under `openrouter/` including router metadata
- [x] Tests **LSA-OC63**–**LSA-OC64**; parity **LSA-OC79**

- Extend compatible presets with `openrouter`.
- Fixture tests for router-specific metadata fields and multi-model headers.
- Document that upstream model behavior varies by routed model — compatibility remains
  best-effort.

---

### 14. LiteLLM / unified proxies (examples only)

**Target version:** documentation / examples, not core adapter  
**Priority:** Low for library surface area.

Provide an **example** showing `assembleStream(upstream.body, openaiCompatibleAdapter())`
when LiteLLM exposes an OpenAI-compatible proxy URL. No `litellmAdapter` — proxy
normalization belongs outside this library.

---

## Cross-cutting work (may span multiple minors)

### Live smoke harness (Phase 10-style)

**Purpose:** Manual confidence beyond fixtures; gitignored; never required in CI.

Proposed additions to repo (or maintainer-only tooling):

| Artifact              | Description                                                   |
| --------------------- | ------------------------------------------------------------- |
| `scripts/live-smoke/` | CLI scripts per provider (text + optional tool prompt)        |
| `.env.example`        | Document required env vars; never commit secrets              |
| `docs/live-smoke.md`  | Checklist: auth, billing, expected event types, failure modes |

Already partially satisfied by `.local-playground/` (gitignored). Formal smoke scripts
could be committed without secrets.

### Core enhancements (only if adapter work exposes gaps)

These are **not** required for every new adapter but may become necessary:

| Enhancement                              | Trigger                                                               |
| ---------------------------------------- | --------------------------------------------------------------------- |
| Additional `RawChunk` kinds              | Provider exposes citation blocks, grounding metadata, etc.            |
| Multi-terminal finish policy             | Justified breaking change → defer to 2.0 or document partial behavior |
| `StreamEvent` citation / grounding types | Gemini Google Search grounding, Cohere citations                      |

Any `StreamEvent` union extension must remain backward compatible for existing consumers
(additive event types only in 1.x).

### Playground improvements (local, gitignored)

- Live mode presets per provider
- “Run all fixtures” batch button
- Ollama localhost preset

---

## Runtime support matrix

The library is **streams-first** and runtime-agnostic for core APIs. Post-1.0 docs should
state support explicitly so users know what works where.

| Runtime            | `assembleStream` / adapters | `assembleFromFile` | `toSSE` | Notes                                                   |
| ------------------ | --------------------------- | ------------------ | ------- | ------------------------------------------------------- |
| Node.js 18+        | yes                         | yes                | yes     | Primary CI target; `node:fs/promises` for replay        |
| Node.js 20/22      | yes                         | yes                | yes     | CI matrix versions                                      |
| Deno               | yes                         | no¹                | yes     | Import npm package; no Node fs replay                   |
| Bun                | yes                         | yes²               | yes     | Verify if `node:fs/promises` behaves as expected        |
| Cloudflare Workers | yes                         | no                 | yes     | Use `ReadableStream` from `fetch`; no local file replay |
| Browser (modern)   | yes                         | no                 | yes     | Consume proxy SSE; do not embed API keys client-side    |

¹ Unless user polyfills or reads files themselves before `assembleFromPayloads`.  
² Best-effort — add a smoke note in docs if Bun-specific issues appear.

**Proposal:** Add a short “Runtimes” subsection to README linking here; no code changes required
unless a runtime regression is reported.

---

## Input format matrix (decode boundary)

Adapters accept **one decoded payload string per `parseChunk` call**. Upstream transport
decoding is the caller's responsibility unless a future optional helper is added (zero-dep).

| Transport                | Typical providers                      | Decode owner                 | Adapter input                         |
| ------------------------ | -------------------------------------- | ---------------------------- | ------------------------------------- |
| SSE (`data:` lines)      | OpenAI Chat, Anthropic, Gemini (often) | `parseSSE()` in core         | JSON string per `data:` payload       |
| NDJSON / JSONL           | Some proxies, batch streams            | App or example helper        | One JSON object string per line       |
| AWS EventStream (binary) | Bedrock                                | App / AWS SDK / example util | Decoded JSON text per event           |
| WebSocket text frames    | Some realtime APIs                     | App                          | Frame string → often SSE-like or JSON |
| Non-streaming JSON body  | All providers (response mode)          | HTTP client                  | `parseResponse(body)`                 |

**Rule for new adapters:** Document in the adapter guide **where decoding stops** and include
an example if binary framing is common (Bedrock, future Vertex).

---

## Provider drift policy

Providers change streaming formats without semver. Post-1.0 maintenance rules:

1. **Detection** — golden test failures, user issues, or upstream changelog monitoring.
2. **Fix class** — mapping bug → **patch**; additive new events → **minor** if new export/options needed.
3. **Fixtures** — add a regression fixture reproducing the drift; never delete old fixtures without a major.
4. **Communication** — CHANGELOG entry names provider + symptom (“Gemini usage field moved”).
5. **Compatibility matrix** — update quirks table same PR as the fix.
6. **No silent loss** — adapters must not drop unknown fields without documenting in `metadata.raw` when safe.

Suggested maintainer cadence: review OpenAI, Anthropic, and Google release notes **monthly**
or before each planned minor release.

---

## Fixture provenance standard

Every fixture directory should include `test/fixtures/<name>/README.md` (or inline comment in
golden test) documenting:

| Field                | Required        | Example                                     |
| -------------------- | --------------- | ------------------------------------------- |
| `source`             | yes             | `synthetic`, `redacted-live`, `docs-shaped` |
| `provider`           | yes             | `openai-chat`, `gemini`                     |
| `api-version` / date | yes             | `2024-11`, `2026-05-26`                     |
| `model`              | if applicable   | `gpt-4o-mini`, `claude-3-5-sonnet`          |
| `redaction`          | if live-derived | “API keys and org ids removed”              |

**Rules:**

- Never commit secrets, PII, or full upstream error bodies with account identifiers.
- Prefer synthetic minimal payloads that exercise one behavior each (text, tool, usage, error).
- Redacted-live fixtures are valuable for drift detection but optional when synthetic covers the shape.

---

## Bundle size budget

Zero runtime deps does not mean unlimited bundle growth. Post-1.0 guardrails:

| Artifact                  | Soft budget (post-gzip est.)                    | Action on exceed                          |
| ------------------------- | ----------------------------------------------- | ----------------------------------------- |
| `dist/index.js` (ESM)     | baseline + 15 KB per new adapter                | justify in PR; split subpath if needed    |
| Each `dist/adapters/*.js` | self-contained; avoid duplicating large parsers | reuse `openai-chat/parser.ts`, `utils.ts` |

**Existing regression:** `LSA-MAINT16` / bundle smoke in maintenance tests — extend when
new subpaths ship to assert build artifacts exist and optional size ceiling if practical.

---

## 1.x support policy (proposal)

| Line               | Policy                                                  |
| ------------------ | ------------------------------------------------------- |
| `1.x` latest minor | feature development (new adapters, presets)             |
| `1.x` older minors | security + critical parser fixes only (best-effort)     |
| `1.0.x`            | patch fixes when users remain pinned; encourage upgrade |
| End of 1.x         | TBD; announce in README ≥ 3 months before 2.0           |

No backporting new adapters to already-published minors — users upgrade patch/minor for providers.

---

## External contributor path

For community-proposed providers:

1. **Open an issue** — provider name, API docs link, sample redacted stream (paste or gist).
2. **Fixtures first PR** — `test/fixtures/<provider>/` + expected golden `StreamEvent[]` JSON (can start with synthetic).
3. **Adapter PR** — implementation + tests + compatibility row; one provider per PR preferred.
4. **Review bar** — `pnpm verify` green; no runtime deps; error prefixes consistent (`<adapter>.parseChunk`).
5. **Maintainer merge** — maintainer owns version bump and CHANGELOG for that minor.

Templates (future): `.github/ISSUE_TEMPLATE/new-adapter.md` — optional follow-up, not blocking 1.1.

---

## Adapter conformance harness (proposal)

Reduce duplicated test boilerplate across `LSA-O*`, `LSA-A*`, `LSA-G*`, etc.

**Goal:** internal test helper (not public API) such as:

```ts
// test/helpers/adapter-conformance.ts (proposal)
runAdapterGoldenStream({
	adapter,
	fixturePath,
	expectedEventsPath,
	testIdPrefix: "LSA-G",
});
```

**Checks every adapter should pass:**

- text-only stream → `text.delta` + `text.done` + `finish`
- single tool stream → full `tool_call.*` lifecycle
- provider error payload → `error` or `finish: error` per adapter rules
- non-streaming `parseResponse` parity with stream terminal state
- empty/whitespace chunk → no throw; zero or benign chunks

Implement when third net-new adapter (Gemini) lands to validate the abstraction.

---

## Integration cookbook (examples, not core)

High adoption value **without** new adapters — add under `examples/integrations/`:

| Integration               | Purpose                                                    |
| ------------------------- | ---------------------------------------------------------- |
| Vercel AI SDK             | Map `StreamEvent` → SDK stream parts or custom data stream |
| LangChain.js              | Custom LLM callback / runnable with unified events         |
| Hono / Express middleware | Proxy route using `assembleStream` + `toSSE`               |
| Cloudflare Worker         | Edge proxy pattern (no Node fs)                            |

Each cookbook entry: self-contained, injected `fetch`, fixture-based test or import-only smoke.
Non-goals: official SDK coupling, peer dependencies on framework packages.

---

## 2.0 backlog (explicit major candidates)

Defer to **`2.0.0`** unless strong evidence requires earlier breaking change:

| Item                                                    | Rationale                                                                  |
| ------------------------------------------------------- | -------------------------------------------------------------------------- |
| Multi-choice terminal finish                            | Core currently emits one terminal `finish`; fixing may change event counts |
| Stricter `StreamEvent` typing                           | Remove loose `metadata.raw` or narrow optional fields                      |
| Remove legacy OpenAI `function_call` synthetic ids      | Breaking for consumers relying on `legacy_function:*`                      |
| Rename event types or merge reasoning/refusal semantics | Public consumer migration cost                                             |
| Required adapter capabilities interface                 | e.g. mandate `parseResponse` on all adapters                               |

Document partial behavior in 1.x; link here from compatibility matrix footnotes.

---

## npm publish checklist

**Registry state (2026-05-26):** latest published version is `1.0.1`; repo `main` is at
`1.2.0` (includes Gemini `1.1.0`, compatible preset expansion `1.1.5`–`1.1.6`, Azure `1.2.0`).
Run `node scripts/release-prep.mjs` before tagging.

1. `pnpm verify` green on `main` at release commit (or matching tag).
2. `node scripts/release-prep.mjs` — version/docs/dist/npm drift checks.
3. `npm pack --dry-run --json` — confirm `files` whitelist (`dist`, README, LICENSE).
4. `pnpm smoke:package` — install tarball in temp project; import all subpaths.
5. `npm login` + 2FA enabled on npm account.
6. `git tag vX.Y.Z && git push origin vX.Y.Z` from the release commit.
7. `npm publish` from clean tree matching git tag `vX.Y.Z`.
8. GitHub Release notes from CHANGELOG (use `.local-playground/release-X.Y.Z.md` draft when present).
9. Verify `npm view llm-stream-assemble version`.
10. Optional: enable [npm provenance](https://docs.npmjs.com/generating-provenance-statements) for GitHub Actions later.

---

## Security disclosure

**Reporting:** GitHub private security advisory or email to maintainer (see README Author).

**In scope:**

- Adapter or `toSSE` leaking upstream secrets when `sanitizeErrors: true`
- `metadata.raw` forwarding sensitive fields to clients in documented proxy setups
- ReDoS / excessive buffer growth in `parseSSE` / `parsePartialJSON` (see `maxBufferBytes`)

**Out of scope:**

- Misconfigured user proxies logging raw API keys
- Provider-side data handling

**Response target (proposal):** acknowledge within 7 days; patch release for confirmed leaks affecting default safe paths.

---

## Migration notes template (CHANGELOG)

For each minor, include when applicable:

```markdown
### Migration from 1.0.x to 1.1.0

- New optional subpath: `llm-stream-assemble/adapters/gemini`.
- No changes required for existing OpenAI/Anthropic/Responses integrations.
- If you previously used removed scaffold exports (`notImplemented`), upgrade to 1.0.0+ first.
```

Breaking changes only in major — use dedicated `## Migration to 2.0.0` section when 2.0 ships.

---

## Per-release acceptance checklist (template)

Use this for every post-1.0 minor that ships provider work:

1. **Code** — adapter (+ export + build artifacts if subpath).
2. **Tests** — unit parseChunk, golden stream, non-streaming response, edge cases; full `pnpm verify` green.
3. **Docs** — compatibility row, adapter guide cross-reference if new pattern, README mention, CHANGELOG minor entry.
4. **Version** — `package.json` and CHANGELOG header match.
5. **Semver** — no breaking public API without major bump.
6. **Secrets** — no keys in fixtures, examples, or committed env files.
7. **Live smoke** — optional manual log attached to release notes when billing available.
8. **Fixtures** — provenance documented per fixture provenance standard.
9. **Drift** — compatibility quirks table updated if provider-specific behavior discovered.
10. **Bundle** — maintenance/bundle regressions pass after subpath addition.

---

## Explicit deferrals / reject list

The following provider integrations are **not proposed** for the 1.x line unless
requirements change materially:

| Item                                   | Reason                                                                     |
| -------------------------------------- | -------------------------------------------------------------------------- |
| Hugging Face Inference API (generic)   | Highly model-dependent; better served by compatible preset + user fixtures |
| OpenAI Realtime API (WebSocket audio)  | Binary / session protocol — non-goal                                       |
| Anthropic Computer Use / browser tools | Tool execution domain, not stream parsing                                  |
| Full Vertex AI auth + routing SDK      | Belongs in app layer; adapter accepts decoded payloads only                |
| Provider SDK re-exports                | Violates zero-dependency design                                            |

---

## Open questions (to resolve before each minor)

1. **Gemini Vertex vs Google AI** — one adapter with option flag, or two modules?
2. **Bedrock EventStream** — document helper in examples vs optional tiny internal utility (still zero dep)?
3. **Citation / grounding events** — extend `StreamEvent` in 1.x or stash for 2.0?
4. **Compatible preset explosion** — keep one enum vs split `presets/` directory for maintainability?
5. **Live smoke in CI** — remain opt-in manual forever, or nightly workflow with repository secrets?
6. **DeepSeek reasoning** — sufficient via compatible dialect, or dedicated reasoning parser module?
7. **Conformance harness** — promote to shared helper at Gemini (1.1) or wait until third adapter?
8. **Integration cookbook** — which framework first (Hono vs Vercel AI SDK) based on user demand?
9. **npm provenance** — adopt GitHub Actions publish workflow when registry access restored?
10. **2.0 timing** — trigger major only for multi-finish behavior, or batch more breaking cleanups?

---

## References

- [`compatibility.md`](./compatibility.md) — current feature matrix
- [`adapter-guide.md`](./adapter-guide.md) — implementation steps
- [`proposal.md`](./proposal.md) — original product proposal (historical)
- [`../CHANGELOG.md`](../CHANGELOG.md) — shipped version history

---

## Document history

| Version    | Notes                                                                                                                                                                                                                                                 |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| proposal-2 | Added DeepSeek, Perplexity, Cloudflare, watsonx/AI21; runtime/input matrices; drift policy; fixture provenance; bundle budget; 1.x support; contributor path; conformance harness; integration cookbook; 2.0 backlog; npm/security/migration sections |
| proposal-1 | Initial post-1.0 roadmap drafted after stable `1.0.0` release                                                                                                                                                                                         |
