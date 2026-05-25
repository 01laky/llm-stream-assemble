# Proxy Safety Examples

These examples show how to forward unified `StreamEvent` SSE to browsers without
leaking raw provider errors.

## Threat model

Provider errors can contain internal URLs, request ids, stack traces, or API-key-like
strings. Browser-facing streams should receive sanitized error messages only.

## Pattern

- Use `tapEvents()` for server-side logging and metrics.
- Use `toSSE(events, { sanitizeErrors: true })` for browser-facing streams.
- Never forward raw upstream non-OK response bodies to browsers.
- Redact bearer/API-key-like values before logging server-side.

## Request schema

The Web-standard proxy example accepts a small provider-agnostic body:

```ts
interface ProxyRequestBody {
	provider?: "openai" | "openai-compatible" | "anthropic";
	model?: string;
	messages?: unknown[];
	prompt?: string;
	stream?: boolean;
}
```

The example constructs an upstream body from known fields only and rejects requests
that do not include `messages` or `prompt`.

## Headers

The example sets `Content-Type: text/event-stream` and `Cache-Control: no-cache`.
It intentionally does not set `Connection: keep-alive`, because that header is not
portable across Fetch runtimes.

CORS headers are app-specific and intentionally omitted. Add them in your own
application boundary if needed.

## Browser client

`browser-client.ts` demonstrates consuming data-only unified SSE via `fetch` and a
`ReadableStream` reader. It does not expect named `event:` fields.
