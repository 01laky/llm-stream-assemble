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

| Variable                            | Default            | Purpose                         |
| ----------------------------------- | ------------------ | ------------------------------- |
| `GOOGLE_API_KEY` / `GEMINI_API_KEY` | —                  | API auth (either name accepted) |
| `GEMINI_MODEL`                      | `gemini-2.5-flash` | Model id for smoke prompt       |

### Expected event types (short text prompt)

- `message.start` or `metadata` (early)
- `text.delta` (one or more)
- `text.done`
- `finish` with `reason: "stop"`
- Optional `usage` on final chunks when the API includes token metadata

### Failure modes

| Symptom            | Likely cause                                           |
| ------------------ | ------------------------------------------------------ |
| 401 / 403          | Invalid or missing API key                             |
| 429                | Quota / rate limit                                     |
| Empty stream       | Model or region restriction                            |
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

## Ollama (OpenAI-compatible preset)

Requires a running Ollama instance with an OpenAI-compatible endpoint (default `http://localhost:11434/v1`).

```bash
pnpm build
pnpm smoke:ollama
```

Optional env:

| Variable          | Default                     | Purpose                    |
| ----------------- | --------------------------- | -------------------------- |
| `OLLAMA_BASE_URL` | `http://localhost:11434/v1` | OpenAI-compatible base URL |
| `OLLAMA_MODEL`    | `llama3.2`                  | Model id for smoke prompt  |

If Ollama is unreachable, the script exits **0** with a skip message (local optional check).

### Expected event types

- `text.delta` (required)
- Optional `finish` with `reason: "stop"`

## DeepSeek (OpenAI-compatible preset)

```bash
pnpm build
pnpm smoke:deepseek
```

Requires `DEEPSEEK_API_KEY`.

| Variable            | Default                    | Purpose      |
| ------------------- | -------------------------- | ------------ |
| `DEEPSEEK_API_KEY`  | —                          | Bearer token |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com` | API base     |
| `DEEPSEEK_MODEL`    | `deepseek-chat`            | Model id     |

Uses `openaiCompatibleAdapter({ provider: "deepseek" })`. Expect at least one `text.delta` event.

## Perplexity (OpenAI-compatible preset)

```bash
pnpm build
pnpm smoke:perplexity
```

Requires `PERPLEXITY_API_KEY`.

| Variable              | Default                     | Purpose      |
| --------------------- | --------------------------- | ------------ |
| `PERPLEXITY_API_KEY`  | —                           | Bearer token |
| `PERPLEXITY_BASE_URL` | `https://api.perplexity.ai` | API base     |
| `PERPLEXITY_MODEL`    | `sonar`                     | Model id     |

Uses `openaiCompatibleAdapter({ provider: "perplexity" })`. Expect at least one `text.delta` event.

## xAI Grok (OpenAI-compatible preset)

```bash
pnpm build
pnpm smoke:xai
```

Requires `XAI_API_KEY`.

| Variable       | Default               | Purpose      |
| -------------- | --------------------- | ------------ |
| `XAI_API_KEY`  | —                     | Bearer token |
| `XAI_BASE_URL` | `https://api.x.ai/v1` | API base     |
| `XAI_MODEL`    | `grok-3`              | Model id     |

Uses `openaiCompatibleAdapter({ provider: "xai" })`. Expect at least one `text.delta` event.

## Azure OpenAI (OpenAI-compatible preset)

```bash
pnpm build
pnpm smoke:azure
```

Requires `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_RESOURCE`, and `AZURE_OPENAI_DEPLOYMENT`.

| Variable                   | Default      | Purpose                                             |
| -------------------------- | ------------ | --------------------------------------------------- |
| `AZURE_OPENAI_API_KEY`     | —            | `api-key` header value (not Bearer)                 |
| `AZURE_OPENAI_RESOURCE`    | —            | Azure resource name (`{resource}.openai.azure.com`) |
| `AZURE_OPENAI_DEPLOYMENT`  | —            | Deployment name in URL path                         |
| `AZURE_OPENAI_API_VERSION` | `2024-10-21` | `api-version` query parameter                       |

Uses `openaiCompatibleAdapter({ provider: "azure" })` against the deployment URL
`https://{resource}.openai.azure.com/openai/deployments/{deployment}/chat/completions?api-version={version}`.
Expect at least one `text.delta` event.

## Cloudflare Workers AI (OpenAI-compatible preset)

```bash
pnpm build
pnpm smoke:cloudflare
```

Requires `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

| Variable                | Default                          | Purpose                   |
| ----------------------- | -------------------------------- | ------------------------- |
| `CLOUDFLARE_API_TOKEN`  | —                                | Bearer token for REST API |
| `CLOUDFLARE_ACCOUNT_ID` | —                                | Account id in URL path    |
| `CLOUDFLARE_MODEL`      | `@cf/meta/llama-3.1-8b-instruct` | Workers AI model id       |

Uses `openaiCompatibleAdapter({ provider: "cloudflare" })` against
`https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1/chat/completions`.
The smoke request sets `stream_options: { include_usage: true }` so usage events may appear.
Expect at least one `text.delta` event.

## Checklist before tagging a compatible preset patch

1. `pnpm verify` green (includes `fixtures:check-compatible`).
2. Host golden tests green (`LSA-OC47` … `LSA-OC94`, `LSA-OC108` … `LSA-OC141`).
3. Optional: `pnpm smoke:ollama`, `pnpm smoke:deepseek`, `pnpm smoke:perplexity`, `pnpm smoke:xai`, `pnpm smoke:azure`, and/or `pnpm smoke:cloudflare` when hosts are available.
4. Cloudflare robust suite **LSA-OC170**–**LSA-OC210** green when touching compatible parser defaults.
5. Update `docs/compatibility.md` quirks if live behavior differs from fixtures.
6. Bump `CHANGELOG.md` + `package.json` version together.
