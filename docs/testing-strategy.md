# Testing strategy

**Status:** Active — `1.10.2`  
**Policy:** Zero paid provider API calls in CI.

## Zero API key CI policy

All release gates run on **synthetic and docs-shaped fixtures** under `test/fixtures/`. Live smoke scripts (`pnpm smoke:*`) are maintainer-only and never required in GitHub Actions.

## Fixture tiers and catalog layers

| Layer            | Location                                                    | Role                                                                         |
| ---------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **Discovery**    | [`test/fixtures/REGISTRY.md`](../test/fixtures/REGISTRY.md) | Auto-generated tree walk: adapter, transport, tier, chunk-matrix eligibility |
| **Routing**      | `test/fixtures/edge-catalog/manifest.json`                  | Edge-catalog adapter keys for `createAdapterForEntry`                        |
| **Human map**    | `test/fixtures/edge-catalog/README.md`                      | EC scenario ↔ LSA-ID ↔ fixture file (**MAINT48** audit)                      |
| **ID migration** | [`docs/test-id-migration.md`](test-id-migration.md)         | Retired LSA-IDs → replacement matrix/EC row (**REF35**)                      |

| Tier | Chunk sizes                          | Purpose                                   |
| ---- | ------------------------------------ | ----------------------------------------- |
| 1    | 1, 3, 7, 17, 31, 64 (+ evil offsets) | Full stream golden parity                 |
| 2    | 1, 17, 64                            | Large fixtures (> 32 KiB or > 120 events) |
| 3    | 1, identity                          | Malformed / binary stress                 |

## Performance budget

- Target: **`npm test` ≤ 75s** soft / **90s** hard on a typical dev machine (**LSA-MAINT43**).
- Per-file soft limits documented via **LSA-TH141** (`chunk-split-evil-full` ≤ 25s, `edge-catalog-matrix` ≤ 20s).
- Minimum test count gate: **6620** passing tests (**LSA-REL33** in `release-prep.mjs`).
- CI job timeout: **15 minutes** (GitHub Actions) — headroom over local **MAINT43** budget × Node matrix.

## Matrix profiles (tier-1 parity ownership)

After 1.10.1 consolidation, exactly **one** profile owns tier-1 golden parity per `(fixture, chunkSize)`:

| Profile                  | Owner file                                              | Gate IDs             |
| ------------------------ | ------------------------------------------------------- | -------------------- |
| `tier1-standard`         | `chunk-split-matrix.test.ts`                            | TH01–TH28            |
| `tier1-evil-full`        | `chunk-split-evil-full.test.ts` (matrix vitest project) | TH31–TH33            |
| `tier2`                  | `chunk-split-tier2-matrix.test.ts`                      | TH100–TH105          |
| `edge-catalog`           | `edge-catalog-matrix.test.ts`                           | EC\*, MAINT44        |
| `response-chunk`         | `parse-response-chunk-matrix.test.ts`                   | TH121–TH125, MAINT41 |
| `compatible-presets`     | `compatible-preset-scenario-matrix.test.ts`             | OC381, MAINT47       |
| `logprobs-combinatorial` | `responses-logprobs-combinatorial.test.ts`              | RL91+, MAINT50       |
| `invariants-only`        | `stream-invariants-matrix.test.ts`                      | AC100+, **MAINT51**  |

Synthetic cross-adapter invariants (no fixtures): `cross-adapter-contract-matrix.test.ts` (**X141–180**).

## Full tier-1 evil-offset matrix

`test/chunk-split-evil-full.test.ts` replays **every tier-1** stream fixture through evil-offset chunk sizes only (`floor(len/2)`, `floor(len/3)`, `len-1`). Gate **LSA-TH31** (≥ 450 rows).

Legacy `chunk-split-matrix` adds evil offsets on the **10-sample** set only; full tier-1 evil coverage lives in `chunk-split-evil-full.test.ts`.

## Chunk-split transport policy

Stream goldens use **`assembleStream`** (SSE) or **`assembleFromPayloads` + `jsonlLinesFromByteStream`** (JSONL). Never feed raw JSONL through the SSE parser.

## parseChunk vs stream golden policy

| Path                 | Policy                                                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **parseChunk atoms** | Snapshot rows in `parse-chunk-atom-matrix.test.ts` (**PC01+**); payload catalog in `test/helpers/parse-chunk-payloads.ts` |
| **Stream goldens**   | `.expected.json` via `runGoldenStreamParity`; chunk-split profiles assert replay                                          |

## Non-stream parseResponse matrix

`response-*.json` goldens use **`runGoldenResponseParity`** with byte-split file reads (`parse-response-chunk-matrix.test.ts`). Chunk sizes: `0, 1, 3, 7, 17, 31, 64` — **LSA-TH121**–**LSA-TH125**.

## Logprobs policy

| Layer                            | Owner                                                       |
| -------------------------------- | ----------------------------------------------------------- |
| Shared math / confidence         | `logprobs-core.test.ts`, `align-logprobs-with-text.test.ts` |
| Chat-specific                    | `openai-chat-logprobs.test.ts`                              |
| Responses combinatorial          | `responses-logprobs-combinatorial.test.ts` (**RL91+**)      |
| Edge-catalog EC logprob fixtures | `edge-catalog-matrix.test.ts` (relaxed invariant profile)   |

## Simulated provider E2E

Examples and proxy handlers use **`runSimulatedProviderCall`** / **`buildChunkedFetch`** with injected chunked `fetch` — no network.

## Examples vs matrix E2E

| Location         | Role                                                                    |
| ---------------- | ----------------------------------------------------------------------- |
| `examples/`      | Runnable scripts; manual `pnpm smoke:*`                                 |
| `test/examples/` | Automated regression of example shapes, proxy safety, cookbook snippets |
| Matrices         | Chunked byte replay via `test/helpers/simulated-provider.ts`            |

## Replay offline path

[`examples/node-fetch/replay-fixture.ts`](../examples/node-fetch/replay-fixture.ts) accepts an optional adapter. Matrix: `test/replay-fixture-matrix.test.ts` (**RP\***).

## Malformed / negative catalog

`test/fixtures/malformed/` — adapters must not throw; use `{ recoverMalformed: true }` where applicable (**NR\*** through **NR50**).

## Stream invariants matrix

`test/stream-invariants-matrix.test.ts` — `assertStreamInvariants()` + `assertEventOrdering()` (**LSA-AC100+**). Existence gate: **LSA-MAINT51** (renamed from erroneous MAINT43 code label in 1.10.0).

## Hardening registry

Required matrix and slow suites are listed in **`test/hardening-registry.json`**. Maintenance reads the registry instead of a stale `HARDENING_TESTS` constant.

## When to use live smoke

Manual only — after `pnpm build`, with API keys in `.env`. Optional `--capture` to `.local-playground/`; redact before committing fixtures.

## How to add a new golden

1. Add synthetic `.sse` or `.jsonl` under `test/fixtures/<adapter>/`.
2. Generate `.expected.json` from adapter + assembler (or hand-author from docs).
3. Register transport in REGISTRY (`pnpm fixtures:audit-registry`).
4. Register in `hardening-registry.json` if adding a new matrix owner.
5. Run `pnpm test` — chunk matrix picks up tier-1 entries automatically.

## Edge catalog maintenance

- `pnpm fixtures:check-edge-catalog` — `regenerate-edge-catalog-goldens.ts --check` only (single golden engine).
- `pnpm audit-edge-cases-catalog` — README scenario mapping + manifest (**LSA-MAINT48**).

## Export smoke

`test/export-smoke.test.ts` (**LSA-EXP01**) imports every `package.json` export subpath after build.

## Maintainer rules (Cursor)

See `.cursor/rules/` — `docs-version-sync`, `fixture-generator-single-path`, `test-id-hygiene`, `hardening-registry-required`.
