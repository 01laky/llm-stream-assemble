/**
 * Maintainer-only live smoke for AWS Bedrock ConverseStream.
 * Run: pnpm build && pnpm smoke:bedrock
 *
 * Requires AWS credentials (env, profile, or SSO) and BEDROCK_MODEL_ID.
 */
import { assembleFromPayloads } from "../../dist/index.js";
import { bedrockAdapter } from "../../dist/adapters/bedrock.js";

const region = process.env.AWS_REGION ?? "us-east-1";
const modelId = process.env.BEDROCK_MODEL_ID;

async function main() {
	if (!modelId) {
		console.error("BEDROCK_MODEL_ID is required (e.g. anthropic.claude-3-5-sonnet-20241022-v2:0)");
		process.exit(1);
	}

	let BedrockRuntimeClient;
	let ConverseStreamCommand;
	try {
		({ BedrockRuntimeClient, ConverseStreamCommand } =
			await import("@aws-sdk/client-bedrock-runtime"));
	} catch (error) {
		console.error(
			"Install @aws-sdk/client-bedrock-runtime (devDependency) to run smoke:bedrock:",
			error,
		);
		process.exit(1);
	}

	const client = new BedrockRuntimeClient({ region });
	const command = new ConverseStreamCommand({
		modelId,
		messages: [{ role: "user", content: [{ text: "Reply with one short word." }] }],
	});

	let response;
	try {
		response = await client.send(command);
	} catch (error) {
		console.warn(`Bedrock unreachable or unauthorized — skipping smoke (${String(error)})`);
		process.exit(0);
	}

	const stream = response.stream;
	if (!stream) {
		console.error("Empty ConverseStream body");
		process.exit(1);
	}

	async function* payloads() {
		for await (const event of stream) {
			if (event.contentBlockDelta) {
				yield JSON.stringify({ contentBlockDelta: event.contentBlockDelta });
			} else if (event.messageStart) {
				yield JSON.stringify({ messageStart: event.messageStart });
			} else if (event.messageStop) {
				yield JSON.stringify({ messageStop: event.messageStop });
			} else if (event.metadata) {
				yield JSON.stringify({ metadata: event.metadata });
			}
		}
	}

	const types = new Set();
	for await (const unified of assembleFromPayloads(payloads(), bedrockAdapter())) {
		types.add(unified.type);
		console.log(unified.type);
	}

	if (!types.has("text.delta") && !types.has("finish")) {
		console.error("Expected text.delta or finish events");
		process.exit(1);
	}

	console.log("\nEvent types seen:", [...types].sort().join(", "));
}

await main();
