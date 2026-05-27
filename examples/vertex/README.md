# Vertex AI Gemini examples

Zero-dependency helpers for **Vertex AI** `streamGenerateContent` / `generateContent` transport. These modules are **not** exported from the library — copy or import them from examples only.

## Files

| File                                             | Purpose                                         |
| ------------------------------------------------ | ----------------------------------------------- |
| [`build-vertex-url.ts`](./build-vertex-url.ts)   | Build publisher-model or tuned-endpoint URLs    |
| [`read-chunk-stream.ts`](./read-chunk-stream.ts) | Split raw HTTP bodies into JSON payload strings |

## Auth and env

Vertex uses **Google Cloud ADC** or a **Bearer** access token — not `GOOGLE_API_KEY`.

```bash
export GOOGLE_CLOUD_PROJECT=your-project
export GOOGLE_CLOUD_LOCATION=us-central1
# Optional: gcloud auth application-default login
```

See [`.env.example`](../../.env.example) for documented variables.

## Decode boundary

1. **Your app** reads the HTTP body and yields one JSON string per Vertex chunk (NDJSON line, brace-balanced object from a JSON array stream, or a single response object).
2. **`geminiAdapter({ apiSurface: "vertex" })`** maps each inner `GenerateContentResponse` JSON object to unified `StreamEvent`s via `assembleFromPayloads`.

Use `readVertexChunkStrings()` when the body may be newline-delimited JSON **or** a streaming JSON array. Use `readVertexJsonlStrings()` when you know each line is one object.

## URL templates

Publisher model:

```text
https://{location}-aiplatform.googleapis.com/v1/projects/{project}/locations/{location}/publishers/google/models/{model}:streamGenerateContent
```

Tuned endpoint:

```text
https://{location}-aiplatform.googleapis.com/v1/projects/{project}/locations/{location}/endpoints/{endpointId}:streamGenerateContent
```

## Node-fetch example

Live streaming demo: [`../node-fetch/vertex-gemini.ts`](../node-fetch/vertex-gemini.ts).

Offline tests pass pre-decoded `eventLines` so no network is required.
