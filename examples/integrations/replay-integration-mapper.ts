import type { StreamAdapter } from "../../src/core/types";
import { assembleFromFile, openaiChatAdapter } from "../../src/index";
import { mapStreamEventToAISDKPart } from "./stream-event-to-ai-sdk-parts";

/** Fixture → assembleStream → mapper snapshot path (no HTTP mock). */
export interface ReplayIntegrationMapperOptions {
	fixturePath?: string;
	adapter?: StreamAdapter;
}

export async function mapFixtureEventsToAISDKParts(
	options: ReplayIntegrationMapperOptions = {},
): Promise<unknown[]> {
	const path = options.fixturePath ?? "test/fixtures/openai-chat/text-basic.sse";
	const adapter = options.adapter ?? openaiChatAdapter();
	const parts: unknown[] = [];
	for await (const event of assembleFromFile(path, adapter)) {
		const mapped = mapStreamEventToAISDKPart(event);
		if (mapped === null) continue;
		if (Array.isArray(mapped)) {
			parts.push(...mapped);
		} else {
			parts.push(mapped);
		}
	}
	return parts;
}

export async function runReplayIntegrationMapperExample(
	options: ReplayIntegrationMapperOptions = {},
): Promise<unknown[]> {
	return mapFixtureEventsToAISDKParts(options);
}
