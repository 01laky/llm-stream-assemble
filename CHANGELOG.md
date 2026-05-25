# Changelog

All notable changes to this project are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/); versioning follows [Semantic Versioning](https://semver.org/).

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
