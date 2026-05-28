# Edge-case showcase

**Status:** Active guide — `1.9.0`

Concrete examples of what breaks when you treat LLM streams as plain text, and how `llm-stream-assemble` handles the **protocol layer**. For positioning vs other tools, see [comparison](./comparison.md).

---

## A) SSE mid-line split (protocol layer)

TCP reads do not respect SSE line boundaries:

```text
TCP read 1:  data: {"choices":[{"delta":{"content":"Hel
TCP read 2:  lo"}}]}
             ↑ naive concat or JSON.parse on read 1 fails
```

**What we do:** `parse-sse.ts` buffers bytes until a line terminator before yielding a payload.

**Proven in tests:** `test/parse-sse.test.ts` — **LSA-C04** (mid-line buffer), **LSA-C-EXT21** (CRLF split).

---

## B) Tool argument JSON partials (assembly layer)

Tool parameters stream as fragments — not one JSON object per chunk:

```text
tool_call.args.delta: "{"
tool_call.args.delta: "\"city\":"
tool_call.args.delta: "\"Paris\"}"
         ↓
tool_call.done → args: { "city": "Paris" }
```

**What we do:** `EventAssembler` accumulates args until `tool_call.done`, then parses JSON.

**Fixtures:** `test/fixtures/openai-chat/tool-single.sse` — covered by `test/openai-chat-tools.test.ts`.

**Anthropic variant:** fine-grained `input_json_delta` may be invalid JSON until the block ends — fixture `test/fixtures/anthropic/tool-use.sse`, tests **LSA-A\***.

**Strict mode:** pass `{ strictToolArgs: true }` to `assembleStream` / `assembleFromPayloads` to throw on invalid JSON at completion — cross-adapter **LSA-X71**–**X76**.

---

## C) JSON mode streaming

Structured output streams as string deltas, not a parsed object:

```text
json.delta: "{\"na"
json.delta: "me\":"
json.delta: "\"John\"}"
         ↓
json.done → "{\"name\":\"John\"}"  (parse in your app)
```

**Fixture:** `test/fixtures/openai-chat/json-mode.sse`

Use `openaiChatAdapter({ jsonMode: true })` or the matching option on other adapters.

Post-finish json deltas are dropped by the shared assembler — **LSA-X65**–**X70**.

---

## D) UI layer — markdown fences (non-goal)

Model text can split markdown code fences across **text tokens**:

````text
text.delta: "```json\n{"
text.delta: "\"a\":1}\n```"
````

That is **rendering** concern — feed `text.delta` into your markdown UI. This library does **not** parse or reassemble markdown/XML fences inside model output. See README [Non-goals](../README.md#non-goals).

---

## E) DIY vs `assembleStream`

| DIY (`+=` / manual reader)            | `llm-stream-assemble`                                        |
| ------------------------------------- | ------------------------------------------------------------ |
| `reader.read()` loop + string concat  | `for await (const event of assembleStream(body, adapter))`   |
| Hope each chunk is valid JSON         | Adapter parses each SSE `data:` payload                      |
| Manual tool JSON stitch               | `tool_call.args.delta` → `tool_call.done`                    |
| Separate stream vs non-stream parsers | Same `StreamEvent` via `assembleStream` / `assembleResponse` |
| Re-test every provider dialect        | Built-in adapters + golden fixtures                          |

For framework-level comparison (AI SDK, provider SDKs), see [comparison.md](./comparison.md).

---

## F) Prove it on a fixture (no API key)

Replay a checked-in golden fixture locally:

```ts
import { assembleFromFile, openaiChatAdapter } from "llm-stream-assemble";

for await (const event of assembleFromFile(
	"test/fixtures/openai-chat/tool-single.sse",
	openaiChatAdapter(),
)) {
	if (event.type === "tool_call.done") console.log(event.name, event.args);
}
```

Node/dev helper only (`node:fs`); see README Transforms and [`examples/node-fetch/replay-fixture.ts`](../examples/node-fetch/replay-fixture.ts).

---

## G) Fixture and test provenance

> **Edge suite expansion:** OpenAI Chat / Responses / Anthropic / Gemini / Bedrock deep edge
> cases landed in **1.5.6** (**LSA-OC234**–**OC252**, **LSA-R45**–**R58**, **LSA-A42**–**A55**,
> **LSA-G72**–**G85**, **LSA-B72**–**B78**). Gemini IDs **G64**–**G67**, **G70**, **G71** were
> renumbered to **G86**–**G90** in **1.5.7** to resolve cross-file collisions with
> docs-regression and conformance suites. OpenAI-compatible exhaustive **OC232**–**OC241** were
> renumbered to **OC256**–**OC265** (**OC253**–**OC255** reserved for OpenAI Chat conformance).
> **1.5.7** adds post-finish / golden parity across thin adapters: **LSA-B79**–**B92**,
> **LSA-R59**–**R70**, **LSA-OC266**–**OC275**, **LSA-G91**–**G98**, **LSA-A56**–**A63**,
> **LSA-X73**–**X76** (strictToolArgs for Bedrock, Cohere, Gemini, Responses).

| Topic                                                 | Fixture / test                                                                                                                                                                   |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SSE mid-line split                                    | **LSA-C04**, **LSA-C-EXT21** — `test/parse-sse.test.ts`                                                                                                                          |
| Tool JSON partials                                    | `test/fixtures/openai-chat/tool-single.sse` — `test/openai-chat-tools.test.ts`                                                                                                   |
| Anthropic partial tool input                          | `test/fixtures/anthropic/tool-use.sse`                                                                                                                                           |
| JSON mode                                             | `test/fixtures/openai-chat/json-mode.sse` — **LSA-OC255** conformance                                                                                                            |
| OpenAI Chat shared conformance                        | **LSA-OC253**–**OC255** — `test/openai-chat-conformance.test.ts`                                                                                                                 |
| OpenAI Chat finish matrix                             | **LSA-OC236**, **OC242**–**OC244**, **OC252**, **OC266**–**OC275** — `test/openai-chat-edge-cases.test.ts`                                                                       |
| OpenAI Chat jsonMode / refusal / tools                | **LSA-OC234**, **OC235**, **OC237**, **OC267**, **OC268**                                                                                                                        |
| OpenAI Chat post-finish usage drop                    | **LSA-OC238**, **OC250**, **OC266**, **OC269**                                                                                                                                   |
| OpenAI Chat unicode / legacy function                 | **LSA-OC248**, **OC249**, **OC274**, **OC275**                                                                                                                                   |
| OpenAI Responses function args stream                 | **LSA-R51**, **R52**, **R59**, **R60**                                                                                                                                           |
| OpenAI Responses post-finish reasoning drop           | **LSA-R53**, **R61**, **R62**                                                                                                                                                    |
| OpenAI Responses duplicate terminal events            | **LSA-R49**, **R56**, **R63**, **R64**–**R70**                                                                                                                                   |
| Anthropic stop-reason matrix                          | **LSA-A45**–**A49**, **A56**, **A57**                                                                                                                                            |
| Anthropic refusal + tool block lifecycle              | **LSA-A50**, **A51**, **A55**, **A58**, **A59**–**A63**                                                                                                                          |
| Gemini Google AI finish / partialArgs                 | **LSA-G76**–**G78**, **G84**, **G91**, **G92**, **G93**                                                                                                                          |
| Gemini Google AI SSE / post-finish (renumbered 1.5.7) | **LSA-G86**–**G90**, **G94**–**G98** — `test/gemini-edge-cases.test.ts`                                                                                                          |
| Bedrock max_tokens + tool input incremental           | **LSA-B74**, **B77**, **B79**–**B92** — `test/bedrock-edge-cases.test.ts`                                                                                                        |
| Vertex post-finish usage (cross-adapter)              | **LSA-X64**                                                                                                                                                                      |
| Cross-adapter jsonMode post-finish                    | **LSA-X65**–**X70** — `test/cross-adapter-assembler-edge.test.ts`                                                                                                                |
| Cross-adapter strictToolArgs                          | **LSA-X71**–**X76** — same file                                                                                                                                                  |
| OpenAI-compatible exhaustive (renumbered IDs)         | **LSA-OC256**–**OC265** — `test/openai-compatible-presets-exhaustive.test.ts`                                                                                                    |
| O(n) assembly smoke                                   | **LSA-C52** — `test/performance-smoke.test.ts`; local repro: `pnpm bench:smoke`                                                                                                  |
| Cohere tool-plan reasoning                            | `test/fixtures/cohere/tool-plan.jsonl` — **LSA-CO20**, **LSA-CO03**                                                                                                              |
| Cohere citation events                                | `test/fixtures/cohere/citations-stream.jsonl` — **LSA-CO20b**, **LSA-CO07**, **LSA-CO99**–**CO113**, conformance **LSA-CF01**                                                    |
| Perplexity citation events                            | `test/fixtures/openai-compatible/perplexity/` — **LSA-OC276**–**OC289**, conformance **LSA-CF02**                                                                                |
| Gemini / Vertex grounding                             | **LSA-G100**–**G110**, **LSA-GV133**–**GV136**, conformance **LSA-CF03**–**LSA-CF04**                                                                                            |
| Citation core / transform / toSSE pipeline            | **LSA-CT01**–**CT55** — `test/citation-grounding-core.test.ts`, `test/citation-grounding-edge.test.ts`                                                                           |
| Citation span helper                                  | **LSA-CSA01**–**CSA12** — `citationSpanAnchor()`                                                                                                                                 |
| Citation conformance                                  | **LSA-CF01**–**LSA-CF05** — `test/citation-grounding-conformance.test.ts`                                                                                                        |
| Compatible citation presets                           | **LSA-OC276**–**OC295** — `test/openai-compatible-citations.test.ts`                                                                                                             |
| Cross-adapter citation/grounding drops                | **LSA-X77**–**X85** — `test/cross-adapter-assembler-edge.test.ts`                                                                                                                |
| Cross-adapter logprob ordering / post-finish drops    | **LSA-X86**–**X98** — `test/cross-adapter-assembler-edge.test.ts`                                                                                                                |
| OpenAI Chat logprob stream + response                 | `test/fixtures/openai-chat/logprobs-*.sse` — **LSA-LP01**–**LP75**, **LSA-OC296**–**OC318**                                                                                      |
| OpenAI-compatible logprob preset                      | `test/fixtures/openai-compatible/logprobs-stream.sse`, `groq/` — **LSA-OC306**–**OC308**                                                                                         |
| Logprob ordering / null semantics                     | **LSA-LPH01**–**LPH08** — logprob before text on same chunk; `logprobs: null` → no events                                                                                        |
| Logprob helpers (confidence + text alignment)         | **LSA-LPA01**–**LPA12** — `logprobConfidence()`, `alignLogprobsWithText()`                                                                                                       |
| Logprob fixture maintainer                            | **LSA-LF01**–**LF05** — Chat + compatible conformance in `test/logprobs-conformance.test.ts`                                                                                     |
| Logprob fixture maintainer (extended)                 | **LSA-LF01**–**LF08** — `scripts/generate-openai-logprob-fixtures.mjs`                                                                                                           |
| OpenAI Responses logprobs core mapping                | **LSA-RL01**–**RL25** — `test/responses-logprobs-core.test.ts` (parseChunk, ordering, done-batch, parseResponse, transforms)                                                     |
| OpenAI Responses logprob extended edge                | **LSA-RL26**–**RL90** — `test/responses-logprobs-edge.test.ts` (malformed entries, position state, SSE splits, strictToolArgs, lifecycle, golden parity)                         |
| OpenAI Responses logprob conformance                  | **LSA-LF06**–**LF11** — `test/logprobs-conformance.test.ts` Responses golden parity + maintainer `--check`                                                                       |
| OpenAI Responses logprob integration edge             | **LSA-R71**–**R85** — `test/openai-responses-conformance.test.ts`, `test/openai-responses-edge-cases.test.ts`, golden streams (**R86**–**R90**)                                  |
| Integration cookbook Responses logprob replay         | **LSA-INT55**–**INT58** — `test/examples/integration-cookbook.test.ts` + [integration-cookbook § Responses replay](./integration-cookbook.md#offline-replay--responses-logprobs) |
| Cohere late tool id                                   | `test/fixtures/cohere/tool-late-id.jsonl` — **LSA-CO77**, **LSA-CO78**                                                                                                           |
| Vertex envelope wrappers                              | `test/fixtures/gemini/vertex/envelope-wrapped.jsonl` — **LSA-GV07**, **LSA-GV98**                                                                                                |
| Vertex tuned endpoint shape                           | `test/fixtures/gemini/vertex/envelope-tuned-endpoint.jsonl` — **LSA-GV46**                                                                                                       |
| Vertex unknown envelope                               | `test/fixtures/gemini/vertex/unknown-envelope.jsonl` — **LSA-GV05**, **LSA-GV06**, **LSA-GV49**                                                                                  |
| Vertex grounding metadata                             | `test/fixtures/gemini/vertex/grounding-metadata.jsonl` — **LSA-GV99**                                                                                                            |
| Google AI vs Vertex parity                            | `test/fixtures/gemini/text-basic.sse` vs `vertex/text-basic.jsonl` — **LSA-GV97**–**LSA-GV97e**                                                                                  |
| Vertex JSONL line split                               | `examples/vertex/read-chunk-stream.ts` — TCP may split mid-line; buffer until `\n` or brace-balanced object                                                                      |
| Repo-wide LSA-ID uniqueness                           | **LSA-MAINT22** — `test/maintenance.test.ts`                                                                                                                                     |

Per-adapter edge files are the authoritative deep suites; cross-adapter tests guard shared `EventAssembler` policy.

---

## H) Post-finish assembler drop (lifecycle layer)

After `finish`, providers may still emit usage-only or trace metadata. The assembler **drops further chunks** once a terminal finish is processed:

```text
text.delta → finish (stop) → metadata { trace }  ← dropped at assembly layer
```

**What we do:** `EventAssembler` ignores adapter output after the first terminal `finish` per stream.

**Proven in tests:**

```text
LSA-X58–X64 (cross-adapter-assembler-edge.test.ts)
LSA-X65–X70 (cross-adapter jsonMode post-finish — 1.5.7)
LSA-OC233, OC238 (openai-chat)
LSA-R40, R53 (openai-responses)
LSA-A41, A42, A55 (anthropic)
LSA-G89, G72 (gemini google-ai)
LSA-B71, B72 (bedrock)
LSA-CO76, CO89, CO96 (cohere)
```

---

## Mental model

![Chunk assembly flow](./img/chunk-assembly.svg)

```text
SSE bytes → parse-sse (line buffer) → adapter (per payload) → EventAssembler → StreamEvent
```

See also README [Architecture](../README.md#architecture) and `docs/img/assembler-lifecycle.svg`.
