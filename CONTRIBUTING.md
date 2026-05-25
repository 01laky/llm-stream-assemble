# Contributing to llm-stream-assemble

**Maintainer:** Ladislav Kostolny ([01laky@gmail.com](mailto:01laky@gmail.com))

Thank you for your interest in contributing.

## Canonical spec

Read [`docs/proposal.md`](./docs/proposal.md) before making changes. It defines scope, the unified event model, and non-goals.

For adapter work, also read [`docs/adapter-guide.md`](./docs/adapter-guide.md) and update [`docs/compatibility.md`](./docs/compatibility.md).

## Requirements

- **Zero runtime dependencies** for core and adapters — enforced by `pnpm verify:deps` and CI.
- **Golden tests** for any adapter or assembler behavior change (fixture in → expected `StreamEvent[]` out).
- **Long, descriptive commit messages** with subject + body explaining what, why, and how tested.
- **CHANGELOG** — add entries under a version header (**no dates**); bump `package.json` version in the same commit.
- **No AI co-author trailers** in commits or PRs (`Co-authored-by: Cursor`, etc.).

## Development

```bash
pnpm install
pnpm verify
```

Individual commands:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm verify:deps
```

## Pull requests

1. Branch from `main`.
2. Ensure `pnpm verify` passes locally.
3. Include fixtures for new provider behavior.
4. Update compatibility matrix if adapter capabilities change.
5. Do not expand scope into HTTP clients, agent loops, or UI — see proposal non-goals.
