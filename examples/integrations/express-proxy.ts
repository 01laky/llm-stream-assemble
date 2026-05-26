import type { IncomingMessage, ServerResponse } from "node:http";
import {
	handleLLMProxyRequest,
	type ProxyExampleOptions,
} from "../proxy-safety/web-standard-proxy";

export type ExpressProxyOptions = ProxyExampleOptions;

async function readRequestBody(req: IncomingMessage): Promise<Uint8Array> {
	const chunks: Buffer[] = [];
	for await (const chunk of req) {
		chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
	}
	return Buffer.concat(chunks);
}

function incomingMessageToRequest(req: IncomingMessage, body: Uint8Array): Request {
	const host = req.headers.host ?? "localhost";
	const url = `http://${host}${req.url ?? "/"}`;
	const headers = new Headers();
	for (const [key, value] of Object.entries(req.headers)) {
		if (value === undefined) continue;
		if (Array.isArray(value)) {
			for (const part of value) headers.append(key, part);
		} else {
			headers.set(key, value);
		}
	}
	return new Request(url, {
		method: req.method ?? "POST",
		headers,
		body: body.byteLength > 0 ? body : undefined,
	});
}

async function pipeWebResponseToServerResponse(
	webResponse: Response,
	res: ServerResponse,
): Promise<void> {
	res.statusCode = webResponse.status;
	webResponse.headers.forEach((value, key) => {
		res.setHeader(key, value);
	});
	if (!webResponse.body) {
		res.end();
		return;
	}
	const reader = webResponse.body.getReader();
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			res.write(value);
		}
	} finally {
		reader.releaseLock();
	}
	res.end();
}

export function createExpressProxyHandler(options: ExpressProxyOptions = {}) {
	return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
		const body = await readRequestBody(req);
		const request = incomingMessageToRequest(req, body);
		const response = await handleLLMProxyRequest(request, options);
		await pipeWebResponseToServerResponse(response, res);
	};
}

export interface ExpressProxyExampleOptions extends ExpressProxyOptions {
	write?: (text: string) => void;
}

export async function runExpressProxyExample(
	options: ExpressProxyExampleOptions = {},
): Promise<void> {
	const write = options.write ?? ((text: string) => process.stdout.write(text));
	const { createServer } = await import("node:http");
	const handler = createExpressProxyHandler(options);

	await new Promise<void>((resolve, reject) => {
		const server = createServer((req, res) => {
			void handler(req, res).catch(reject);
		});
		server.listen(0, "127.0.0.1", () => {
			const address = server.address();
			if (!address || typeof address === "string") {
				reject(new Error("Could not bind express proxy example server"));
				return;
			}
			const url = `http://127.0.0.1:${address.port}/proxy`;
			void fetch(url, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ prompt: "hi", stream: true }),
			})
				.then((response) => response.text())
				.then((text) => {
					write(text);
					server.close((error) => (error ? reject(error) : resolve()));
				})
				.catch((error) => {
					server.close(() => reject(error));
				});
		});
	});
}
