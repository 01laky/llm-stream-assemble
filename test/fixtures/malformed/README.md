# Malformed stream fixtures

Synthetic SSE and JSONL payloads for negative-path matrix tests (**NR01**–**NR20** in `malformed-stream-matrix.test.ts`).

These files are intentionally invalid or edge-case shaped. Adapters and the assembly pipeline must not throw when fed through byte-chunk replay; assertions cover must-not-throw and benign event output only.

**Zero paid provider API** — all fixtures are hand-authored or derived from docs-shaped snippets; no live capture.
