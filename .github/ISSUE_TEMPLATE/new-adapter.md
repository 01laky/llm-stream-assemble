---
name: New provider adapter
about: Propose a new provider adapter for llm-stream-assemble
title: "adapter: "
labels: adapter
---

## Provider

- **Name:**
- **API docs URL:**
- **Streaming format:** (SSE / JSONL / other — include sample `data:` line if SSE)

## Sample stream (required)

Paste a **redacted** sample stream or attach a gist. Remove API keys, account ids, and private prompts.

```
(paste here)
```

## Mapping notes

Which unified events do you expect?

- [ ] text.\*
- [ ] tool_call.\*
- [ ] reasoning.\*
- [ ] json.\*
- [ ] usage
- [ ] finish / error

## Contribution plan

- [ ] Fixtures under `test/fixtures/<adapter-name>/` with provenance README
- [ ] Golden tests (fixture → expected `StreamEvent[]`)
- [ ] Zero runtime dependencies
- [ ] `pnpm verify` green
- [ ] Row in `docs/compatibility.md`

One provider per pull request preferred. Maintainers own semver bump and CHANGELOG for merged adapters.

See [adapter author guide](../docs/adapter-guide.md).
