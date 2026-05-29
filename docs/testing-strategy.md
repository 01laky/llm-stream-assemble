# Testing strategy

**Status:** Active — `1.10.0`  
**Policy:** Zero paid provider API calls in CI.

## Zero API key CI policy

All release gates run on **synthetic and docs-shaped fixtures** under `test/fixtures/`. Live smoke scripts (`pnpm smoke:*`) are maintainer-only and never required in GitHub Actions.

## Fixture tiers and provenance

See [`test/fixtures/REGISTRY.md`](../test/fixtures/REGISTRY.md) for the auto-generated catalog: adapter, transport (`sse` / `jsonl`), tier, and chunk-matrix eligibility.

| Tier | Chunk sizes                                       | Purpose                                   |
| ---- | ------------------------------------------------- | ----------------------------------------- |
| 1    | 1, 3, 7, 17, 31, 64 (+ evil offsets on 10-sample in legacy matrix) | Full stream golden parity                 |
| 2    | 1, 17, 64                                         | Large fixtures (> 32 KiB or > 120 events) |
| 3    | 1, identity                                       | Malformed / binary stress                 |

## Performance budget

- Target: **`npm test` ≤ 75s** soft / **90s** hard on a typical dev machine (**LSA-MAINT43**).
- CI documents per-file soft limits in **LSA-MAINT49** / **LSA-TH141** (`chunk-split-evil-full` ≤ 25s, `edge-catalog-matrix` ≤ 20s).
- Minimum test count gate: **6000** passing tests (**LSA-REL33** in `release-prep.mjs`).

## Full tier-1 evil-offset matrix (1.10.0)

`test/chunk-split-evil-full.test.ts` replays **every tier-1** stream fixture through evil-offset chunk sizes only (`floor(len/2)`, `floor(len/3)`, `len-1`) — not just the historical 10-sample set. Gate **LSA-TH31** (≥ 450 rows).

## Chunk-split matrix (tier-1 standard sizes)

Stream goldens are replayed through **`assembleStream`** (SSE) or **`assembleFromPayloads` + `jsonlLinesFromByteStream`** (JSONL). Never feed raw JSONL through the SSE parser.

The legacy `chunk-split-matrix` still adds evil offsets on the **10-sample** set only; full tier-1 evil coverage lives in `chunk-split-evil-full.test.ts`.

## Non-stream parseResponse matrix

`response-*.json` goldens use **`runGoldenResponseParity`** with byte-split file reads (see `test/parse-response-chunk-matrix.test.ts`).

1.10.0 gate update: `RESPONSE_CHUNK_SIZES` now covers `0, 1, 3, 7, 17, 31, 64` with anchors **LSA-TH121**–**LSA-TH125**.

## Simulated provider E2E

Examples and proxy handlers use **`runSimulatedProviderCall`** / **`fakeStreamingFetch`** with injected chunked `fetch` — no network.

## Replay offline path

[`examples/node-fetch/replay-fixture.ts`](../examples/node-fetch/replay-fixture.ts) accepts an optional adapter for any checked-in fixture. Matrix: `test/replay-fixture-matrix.test.ts` (**RP\***).

## Malformed / negative catalog

`test/fixtures/malformed/` — adapters must not throw; use `{ recoverMalformed: true }` where applicable (**NR\***).

1.10.0 expansion: malformed fixtures and adapter matrix extended through **LSA-NR50**.

## Compatibility preset matrix

`test/compatible-preset-scenario-matrix.test.ts` replays **HOST_COMPATIBLE_PRESETS × 14 scenarios** (>=150 rows), anchored by **LSA-OC381** and waiver note **LSA-MAINT47**.

## Stream invariants matrix

`test/stream-invariants-matrix.test.ts` applies `assertStreamInvariants()` + `assertEventOrdering()` over fixture/chunk rows with **LSA-AC100+** gates.

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

## Edge catalog maintenance

- `pnpm fixtures:check-edge-catalog` validates generated edge-catalog expected events.
- `pnpm audit-edge-cases-catalog` validates `test/fixtures/edge-catalog/README.md` scenario mapping and manifest consistency (**LSA-MAINT48**).
