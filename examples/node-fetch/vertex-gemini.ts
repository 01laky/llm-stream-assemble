import { assembleFromPayloads, geminiAdapter } from "../../src/index";
import { buildVertexStreamUrl } from "../vertex/build-vertex-url";
import { readVertexJsonlStringsFromText } from "../vertex/read-chunk-stream";

export interface VertexGeminiExampleOptions {
	projectId?: string;
	location?: string;
	model?: string;
	accessToken?: string;
	fetchImpl?: typeof fetch;
	/** Pre-decoded jsonl lines for offline tests */
	eventLines?: string[];
	write?: (text: string) => void;
	jsonMode?: boolean;
}

export function formatVertexRpcError(body: unknown): string {
	if (!body || typeof body !== "object" || Array.isArray(body)) {
		return "Vertex request failed.";
	}
	const record = body as Record<string, unknown>;
	const error = record.error;
	if (!error || typeof error !== "object" || Array.isArray(error)) {
		return "Vertex request failed.";
	}
	const message = (error as Record<string, unknown>).message;
	return typeof message === "string" && message.length > 0 ? message : "Vertex request failed.";
}

export async function runVertexGeminiExample(
	options: VertexGeminiExampleOptions = {},
): Promise<void> {
	const write = options.write ?? ((text: string) => process.stdout.write(text));
	const eventLines = options.eventLines;

	if (eventLines && eventLines.length > 0) {
		for await (const event of assembleFromPayloads(
			readVertexJsonlStringsFromText(eventLines.join("\n")),
			geminiAdapter({ apiSurface: "vertex", jsonMode: options.jsonMode }),
		)) {
			if (event.type === "text.delta") write(event.text);
			if (event.type === "json.delta") write(event.delta);
			if (event.type === "reasoning.delta") write(`[thought] ${event.text}`);
			if (event.type === "tool_call.done") write(`\nTool: ${event.name}\n`);
			if (event.type === "finish") write(`\nFinish: ${event.reason}\n`);
		}
		return;
	}

	const projectId = options.projectId ?? process.env.GOOGLE_CLOUD_PROJECT;
	const location = options.location ?? process.env.VERTEX_LOCATION ?? "us-central1";
	const model = options.model ?? process.env.VERTEX_MODEL ?? "gemini-2.5-flash";
	const accessToken = options.accessToken ?? process.env.VERTEX_ACCESS_TOKEN;

	if (!projectId) throw new Error("GOOGLE_CLOUD_PROJECT is required");
	if (!accessToken) {
		throw new Error("VERTEX_ACCESS_TOKEN is required (ADC token — not GOOGLE_API_KEY)");
	}

	const fetchImpl = options.fetchImpl ?? fetch;
	const url = buildVertexStreamUrl({ projectId, location, model });

	const response = await fetchImpl(url, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${accessToken}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			contents: [{ role: "user", parts: [{ text: "Say hello in one short sentence." }] }],
		}),
	});

	if (!response.ok) {
		let message = `Vertex HTTP ${response.status}`;
		try {
			message = formatVertexRpcError(await response.json());
		} catch {
			// ignore parse failure
		}
		throw new Error(message);
	}

	if (!response.body) throw new Error("Vertex response body is empty");

	const { readVertexJsonlStrings } = await import("../vertex/read-chunk-stream");

	async function* payloadLines() {
		for await (const line of readVertexJsonlStrings(response.body!)) {
			yield line;
		}
	}

	for await (const event of assembleFromPayloads(
		payloadLines(),
		geminiAdapter({ apiSurface: "vertex", jsonMode: options.jsonMode }),
	)) {
		if (event.type === "text.delta") write(event.text);
		if (event.type === "json.delta") write(event.delta);
		if (event.type === "reasoning.delta") write(`[thought] ${event.text}`);
		if (event.type === "tool_call.done") write(`\nTool: ${event.name}\n`);
		if (event.type === "finish") write(`\nFinish: ${event.reason}\n`);
	}
}
