# LSA-ID migration (1.10.1)

Maps retired test IDs to their replacement coverage after refactor consolidation.

| Retired ID                    | Replacement                                             | Notes                                                   |
| ----------------------------- | ------------------------------------------------------- | ------------------------------------------------------- |
| LSA-A12–A16                   | `chunk-split-matrix` @0 + `adapter-conformance-matrix`  | Per-adapter `*-golden-stream.test.ts` deduped (**R27**) |
| LSA-DOC213–DOC225 (live pins) | Frozen `docs-positioning-1.10.0.test.ts` CHANGELOG-only | Active pins → **DOC226+** in `docs-positioning.test.ts` |
| LSA-MAINT43 (code label)      | **LSA-MAINT51** stream-invariants matrix                | **MAINT43** reserved for duration budget in docs        |
| LSA-MAINT43 (duration)        | `docs/testing-strategy.md` Performance budget           | Unchanged semantic                                      |
| LSA-MAINT41                   | `parse-response-chunk-matrix` TH121–TH125               | Not evil-offset (see **TH31**)                          |

Edge-catalog **Class A** deletions from `*-edge-cases.test.ts` map to **EC** rows in `test/fixtures/edge-catalog/README.md`.

See also: [`docs/testing-strategy.md`](testing-strategy.md) § Matrix profiles.
