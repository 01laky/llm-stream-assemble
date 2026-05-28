import { byteStreamFromSplitString } from "./byte-stream";

export interface SimulatedProviderCallOptions {
	runExample: (opts: {
		fetchImpl: typeof fetch;
		apiKey?: string;
		write?: (s: string) => void;
	}) => Promise<void>;
	fixtureBody: string;
	contentType?: string;
	chunkSize?: number;
	status?: number;
}

export function buildChunkedFetch(
	fixtureBody: string,
	init: { contentType?: string; status?: number; chunkSize?: number } = {},
): typeof fetch {
	const contentType = init.contentType ?? "text/event-stream";
	const status = init.status ?? 200;
	const chunkSize = init.chunkSize ?? 0;
	return (async () =>
		new Response(chunkSize > 0 ? byteStreamFromSplitString(fixtureBody, chunkSize) : fixtureBody, {
			status,
			headers: { "Content-Type": contentType },
		})) as typeof fetch;
}

export async function runSimulatedProviderCall(
	options: SimulatedProviderCallOptions,
): Promise<{ status: number; output: string }> {
	const output: string[] = [];
	const fetchImpl = buildChunkedFetch(options.fixtureBody, {
		contentType: options.contentType,
		status: options.status,
		chunkSize: options.chunkSize,
	});
	const response = await fetchImpl("https://example.test/v1/chat", {
		method: "POST",
		body: "{}",
	});
	await options.runExample({
		fetchImpl,
		apiKey: "test-key",
		write: (text) => output.push(text),
	});
	return { status: response.status, output: output.join("") };
}
