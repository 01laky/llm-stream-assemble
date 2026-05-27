import { assembleFromPayloads, bedrockAdapter } from "../../src/index";

export interface BedrockExampleOptions {
	region?: string;
	modelId?: string;
	fetchImpl?: typeof fetch;
	/** Pre-decoded event strings for offline tests — bypasses binary decode */
	eventLines?: string[];
	write?: (text: string) => void;
}

/**
 * Offline-first Bedrock ConverseStream example.
 *
 * Live path: use AWS SDK v3 Bedrock Runtime ConverseStreamCommand, decode the
 * EventStream response body to JSON strings, then feed them to bedrockAdapter.
 * See examples/bedrock/decode-event-stream.ts and examples/bedrock/README.md.
 */
export async function runBedrockExample(options: BedrockExampleOptions = {}): Promise<void> {
	const write = options.write ?? ((text: string) => process.stdout.write(text));
	const eventLines = options.eventLines;

	if (eventLines && eventLines.length > 0) {
		async function* payloads() {
			for (const line of eventLines) yield line;
		}
		for await (const event of assembleFromPayloads(payloads(), bedrockAdapter())) {
			if (event.type === "text.delta") write(event.text);
			if (event.type === "tool_call.done") write(`\nTool: ${event.name}\n`);
			if (event.type === "finish") write(`\nFinish: ${event.reason}\n`);
		}
		return;
	}

	const region = options.region ?? process.env.AWS_REGION;
	const modelId = options.modelId ?? process.env.BEDROCK_MODEL_ID;
	if (!region) throw new Error("AWS_REGION is required for live Bedrock example");
	if (!modelId) throw new Error("BEDROCK_MODEL_ID is required for live Bedrock example");

	void options.fetchImpl;
	throw new Error(
		"Live Bedrock streaming requires AWS SDK EventStream decode — use eventLines for offline tests or see examples/bedrock/README.md",
	);
}
