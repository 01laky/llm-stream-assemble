# Performance & runtime behavior

**Status:** Active guide — `1.5.0`

How `llm-stream-assemble` handles streaming work: design properties, memory, and an informal smoke benchmark. This is not a formal benchmark suite or SLA.

---

## Design properties

| Property                                    | Detail                                                                                                                                                            |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Zero runtime dependencies**               | Core and adapters ship with no `dependencies` in `package.json`. Verified in CI via `pnpm verify:deps`.                                                           |
| **Incremental SSE parsing**                 | `parse-sse.ts` accumulates bytes until a line terminator (LF/CRLF) before yielding payloads. No regex backtracking over the full stream.                          |
| **O(n) assembly**                           | Each SSE payload is parsed once; `EventAssembler` appends deltas in a single pass. CI smoke test **LSA-C52** guards against obvious O(n²) behavior on 10k chunks. |
| **Bounded buffers**                         | `maxBufferBytes` in `AssembleOptions` caps text, reasoning, JSON, refusal, and tool-arg accumulation. Exceeding the limit emits a non-recoverable `error` event.  |
| **Thin adapters**                           | Adapters map one payload → `RawChunk[]` without cross-chunk text/tool assembly. Only minimal id/index reconciliation is allowed per stream.                       |
| **No provider SDK**                         | Tree-shakeable subpath exports; you bring your own `fetch`.                                                                                                       |
| **`collectStream` materializes everything** | Use only when you intend to buffer the full assembled output in memory. See README Transforms section.                                                            |

Strict JSON at tool completion: use `strictToolArgs: true` on `EventAssembler` options (via `assembleStream` / `assembleFromPayloads` options). There is no runtime `zod` peer dependency.

---

## Memory & backpressure

- **Assembly buffers grow with response size** — text, tool arguments, reasoning, and JSON mode output must be accumulated to emit `.done` events. This is inherent to stream assembly, not a leak.
- **`assembleStream` on `ReadableStream`** follows consumer speed when you iterate events asynchronously; the library does not materialize the full event array unless you collect it yourself.
- **Do not share one `EventAssembler` across concurrent streams** — create a new assembly per request (default for all public entry points). See [FAQ](./faq.md) and README Architecture lifecycle.

---

## Runtime targets

| Runtime            | Status            | Notes                                     |
| ------------------ | ----------------- | ----------------------------------------- |
| Node.js 18+        | Primary           | CI matrix; recommended for servers        |
| Cloudflare Workers | Supported pattern | `TransformStream`, `fetch` proxy examples |
| Deno / Bun         | Best-effort       | Web streams compatible; not gated in CI   |

---

## Smoke benchmark (informal)

Scenario matches **`test/performance-smoke.test.ts`** (**LSA-C52**):

- 10_000 small SSE `data:` lines + `data: [DONE]`
- Identity adapter emits one `text-delta` per payload
- Final `text.done` aggregates 10_000 characters

### How to reproduce

```bash
pnpm build
pnpm bench:smoke
# or: node scripts/bench-smoke.mjs
```

Example output shape (numbers vary by machine and Node version):

| Scenario      | Chunks | Notes                                    | Typical result                                      |
| ------------- | ------ | ---------------------------------------- | --------------------------------------------------- |
| LSA-C52 smoke | 10k    | single-char deltas; CI threshold &lt; 5s | ~36 ms on Node v20.18.3 (local; varies by hardware) |

CI enforces **&lt; 5000 ms** for LSA-C52; local `bench-smoke` is for maintainer curiosity only — not a CI gate.

**Disclaimer:** Informal smoke benchmark — not ops/sec marketing numbers. No allocation profiling in v1.4.1.
