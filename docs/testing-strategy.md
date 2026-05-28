# Testing strategy

**Status:** Active — `1.9.0`  
**Policy:** Zero paid provider API calls in CI.

## Zero API key CI policy

All release gates run on **synthetic and docs-shaped fixtures** under `test/fixtures/`. Live smoke scripts (`pnpm smoke:*`) are maintainer-only and never required in GitHub Actions.

## Fixture tiers and provenance

See [`test/fixtures/REGISTRY.md`](../test/fixtures/REGISTRY.md) for the auto-generated catalog: adapter, transport (`sse` / `jsonl`), tier, and chunk-matrix eligibility.

| Tier | Chunk sizes                                       | Purpose                                   |
| ---- | ------------------------------------------------- | ----------------------------------------- |
| 1    | 1, 3, 7, 17, 31, 64 (+ evil offsets on 10-sample) | Full stream golden parity                 |
| 2    | 1, 17, 64                                         | Large fixtures (> 32 KiB or > 120 events) |
| 3    | 1, identity                                       | Malformed / binary stress                 |

## Chunk-split matrix

Stream goldens are replayed through **`assembleStream`** (SSE) or **`assembleFromPayloads` + `jsonlLinesFromByteStream`** (JSONL). Never feed raw JSONL through the SSE parser.

Evil offset sample (10 fixtures): chunk sizes `floor(len/2)`, `floor(len/3)`, `len-1` in addition to the standard set.

## Non-stream parseResponse matrix

`response-*.json` goldens use **`runGoldenResponseParity`** with byte-split file reads (see `test/parse-response-chunk-matrix.test.ts`).

## Simulated provider E2E

Examples and proxy handlers use **`runSimulatedProviderCall`** / **`fakeStreamingFetch`** with injected chunked `fetch` — no network.

## Replay offline path

[`examples/node-fetch/replay-fixture.ts`](../examples/node-fetch/replay-fixture.ts) accepts an optional adapter for any checked-in fixture. Matrix: `test/replay-fixture-matrix.test.ts` (**RP\***).

## Malformed / negative catalog

`test/fixtures/malformed/` — adapters must not throw; use `{ recoverMalformed: true }` where applicable (**NR\***).

## Performance budget

- Target: **`npm test` ≤ 60s** on a typical dev machine.
- CI soft gate: **55s** documented in **MAINT39**; shrink chunk matrix tiers before dropping scenario coverage.

## When to use live smoke

Manual only — after `pnpm build`, with API keys in `.env`. Optional `--capture` to `.local-playground/`; redact before committing fixtures.

## How to add a new golden

1. Add synthetic `.sse` or `.jsonl` under `test/fixtures/<adapter>/`.
2. Generate `.expected.json` from adapter + assembler (or hand-author from docs).
3. Register transport in REGISTRY (`pnpm fixtures:audit-registry`).
4. Run `pnpm test` — chunk matrix picks up tier-1 entries automatically.
