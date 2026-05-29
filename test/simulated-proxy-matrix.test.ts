import { EventEmitter } from "node:events";
import type { IncomingMessage, ServerResponse } from "node:http";
import { PassThrough } from "node:stream";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createExpressProxyHandler } from "../examples/integrations/express-proxy";
import { handleHonoLLMProxy } from "../examples/integrations/hono-proxy";
import { buildChunkedFetch } from "./helpers/simulated-provider";
import { parseUnifiedSSE, readResponseText } from "./examples/helpers";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

type ProxyProvider = "openai" | "openai-compatible" | "anthropic";

function fixture(relativePath: string): string {
	return readFileSync(join(rootDir, relativePath), "utf8");
}

function proxyRequest(provider: ProxyProvider): Request {
	return new Request("https://example.test/proxy", {
		method: "POST",
		body: JSON.stringify({ provider, prompt: "hi", stream: true }),
	});
}

function mockIncomingRequest(body: string): IncomingMessage {
	const stream = new PassThrough();
	stream.end(body);
	const req = stream as unknown as IncomingMessage;
	req.method = "POST";
	req.url = "/proxy";
	req.headers = { host: "localhost", "content-type": "application/json" };
	return req;
}

function mockServerResponse(): ServerResponse & {
	headers: Record<string, string | number>;
	chunks: Buffer[];
} {
	const res = new EventEmitter() as ServerResponse & {
		headers: Record<string, string | number>;
		chunks: Buffer[];
	};
	res.headers = {};
	res.chunks = [];
	res.statusCode = 200;
	res.setHeader = (name: string, value: string | number) => {
		res.headers[name.toLowerCase()] = value;
	};
	res.write = (chunk: string | Uint8Array) => {
		res.chunks.push(Buffer.from(chunk));
		return true;
	};
	res.end = (chunk?: string | Uint8Array) => {
		if (chunk !== undefined) res.write(chunk);
		res.emit("finish");
		return res;
	};
	return res;
}

describe("simulated proxy matrix", () => {
	const fixtures = [
		{
			provider: "openai" as const,
			name: "oai-text",
			body: fixture("test/fixtures/openai-chat/text-basic.sse"),
		},
		{
			provider: "openai" as const,
			name: "oai-tools",
			body: fixture("test/fixtures/openai-chat/tool-parallel.sse"),
		},
		{
			provider: "openai" as const,
			name: "oai-usage",
			body: fixture("test/fixtures/openai-chat/usage.sse"),
		},
		{
			provider: "anthropic" as const,
			name: "anthropic-text",
			body: fixture("test/fixtures/anthropic/text-basic.sse"),
		},
		{
			provider: "anthropic" as const,
			name: "anthropic-tools",
			body: fixture("test/fixtures/anthropic/tool-parallel.sse"),
		},
		{
			provider: "openai-compatible" as const,
			name: "compatible-text",
			body: fixture("test/fixtures/openai-compatible/groq/text-basic.sse"),
		},
	] as const;
	const chunkSizes = [0, 1, 7] as const;
	const proxyKinds = ["hono", "express"] as const;
	const rows = fixtures.flatMap((entry) =>
		chunkSizes.flatMap((chunkSize) =>
			proxyKinds.map((proxyKind) => ({
				entry,
				chunkSize,
				proxyKind,
				label: `${entry.name}@${chunkSize}:${proxyKind}`,
			})),
		),
	);
	const gatedRows = rows.map((row, index) => ({
		...row,
		gate: index < 35 ? `LSA-INT${86 + index}` : "LSA-INT120+",
	}));

	it("LSA-INT85: proxy matrix expands to >= 36 rows", () => {
		expect(rows.length).toBeGreaterThanOrEqual(36);
	});

	it.each(gatedRows)("$gate $label streams unified events", async (row) => {
		const fetchImpl = buildChunkedFetch(row.entry.body, { chunkSize: row.chunkSize });
		if (row.proxyKind === "hono") {
			const response = await handleHonoLLMProxy(proxyRequest(row.entry.provider), {
				apiKey: "key",
				fetchImpl,
			});
			expect(response.headers.get("Content-Type")).toBe("text/event-stream");
			const text = await readResponseText(response);
			const events = parseUnifiedSSE(text);
			expect(events.some((event) => (event as { type?: string }).type === "finish")).toBe(true);
			return;
		}

		const handler = createExpressProxyHandler({ apiKey: "key", fetchImpl });
		const req = mockIncomingRequest(
			JSON.stringify({ provider: row.entry.provider, prompt: "hi", stream: true }),
		);
		const res = mockServerResponse();
		await handler(req, res);
		expect(res.headers["content-type"]).toBe("text/event-stream");
		const text = Buffer.concat(res.chunks).toString("utf8");
		const events = parseUnifiedSSE(text);
		expect(events.some((event) => (event as { type?: string }).type === "finish")).toBe(true);
	});
});
