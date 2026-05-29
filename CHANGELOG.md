# Changelog

All notable changes to this project are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/); versioning follows [Semantic Versioning](https://semver.org/).

Older releases through **1.10.0** and below: [CHANGELOG-archive.md](./CHANGELOG-archive.md).

## [1.10.2]

### Added

- **Edge catalog EC73–EC88** — sixteen post-refactor fixtures covering multichoice, legacy `function_call`, OpenAI-compatible presets (DeepSeek reasoning, Azure errors/content-filter/reasoning, Groq missing tool id), Responses refusal+logprob, Bedrock parallel tools and text/tool interleave, Gemini partial tools, Anthropic text→tool, Cohere tool-plan and legacy citation metadata, Vertex partial tool args.
- **`test/assembly-session-edge.test.ts`** — `AssemblySession` abort, `[DONE]`, `recoverMalformed`, incomplete flush, `assembleFromPayloads` golden parity, and transform abort-signal paths (**LSA-AS01**–**AS08**).
- **`test/edge-catalog-extended-matrix.test.ts`** — chunk sizes **3/7/31** and full **evil-offset** parity for EC73–EC88 (**LSA-EC73**, **LSA-EC88**).

### Fixed

- **Edge-catalog manifest inference** — `.jsonl` extension no longer enables `jsonMode`; cohere filenames route before anthropic `ec15` regex; **ec70** maps to cohere; explicit **MANIFEST_OVERRIDES** for compatible presets and cohere tool-plan.

### Notes

- Edge catalog: **96** fixtures (EC01–EC88 + 8× tier2-large); **MAINT44** floor **≥88**.
- Test count **6738** (6620 REL33 floor + new matrix/assembly gates).

## [1.10.1]

### Changed

- **Source refactor** — split Cohere, Bedrock, Gemini, and OpenAI Responses adapters into module folders (`index`, `stream-parser`, `parse-response`, helpers); **`AssemblySession`** unifies `assembleFromPayloads` and `createAssemblyTransform`; renamed `adapters/shared/` → **`adapters/common/`**.
- **Test harness** — `test/hardening-registry.json` replaces stale `HARDENING_TESTS` lists; **`matrix-runner.ts`** helper; vitest **unit/matrix** projects; **export smoke** gate (**EXP01**); **MAINT51** stream-invariants gate (duration stays **MAINT43** in docs).
- **Docs** — `docs/testing-strategy.md` catalog layers + matrix profiles; `docs/test-id-migration.md`; `docs/usage-guides.md`; README trimmed to index; `.cursor/rules` for docs sync, fixture generators, test IDs, hardening registry; Mermaid/SVG diagrams rebuilt at **1.10.1**.
- **CI / release** — **REL33** minimum test count **6620**; GitHub Actions **15-minute** job timeout; duplicate `fixtures:generate-edge-catalog` script key removed; active CHANGELOG archive split.

### Fixed

- **MAINT ID drift** — **MAINT43** (duration) vs erroneous code label for stream-invariants → **MAINT51**; frozen **DOC222**/**DOC223** assertions corrected; **MAINT41** = parse-response TH121.

### Notes

- No intentional public API changes; semver-safe from **1.10.0**.
- Test count **6624** (6620 floor + export smoke gates).
