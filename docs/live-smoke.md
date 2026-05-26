# Live smoke (maintainer-only)

Manual confidence checks beyond fixture-based CI. **Never required in CI** — no API keys in the repository.

## Prerequisites

1. Copy `.env.example` to `.env` in the repo root (or export variables in your shell).
2. Set `GOOGLE_API_KEY` or `GEMINI_API_KEY` with billing enabled on Google AI.
3. Build the package: `pnpm build`.

## Gemini

```bash
pnpm exec tsx scripts/live-smoke/gemini.ts
```

Optional env:

| Variable | Default | Purpose |
| -------- | ------- | ------- |
| `GOOGLE_API_KEY` / `GEMINI_API_KEY` | — | API auth (either name accepted) |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Model id for smoke prompt |

### Expected event types (short text prompt)

- `message.start` or `metadata` (early)
- `text.delta` (one or more)
- `text.done`
- `finish` with `reason: "stop"`
- Optional `usage` on final chunks when the API includes token metadata

### Failure modes

| Symptom | Likely cause |
| ------- | ------------ |
| 401 / 403 | Invalid or missing API key |
| 429 | Quota / rate limit |
| Empty stream | Model or region restriction |
| Tool smoke skipped | Set `GEMINI_SMOKE_TOOLS=1` to run optional tool prompt |

## Checklist before tagging a Gemini minor

1. `pnpm verify` green on `main`.
2. Fixture golden tests green (`LSA-G36` … `LSA-G52`).
3. Optional: run `scripts/live-smoke/gemini.ts` and confirm event **types** match expectations.
4. Update `docs/compatibility.md` if live behavior differs from fixtures.
5. Bump `CHANGELOG.md` + `package.json` version together.

## Security

- Do not commit `.env` or API keys.
- Live smoke logs event types only — avoid logging full provider payloads in shared terminals.
