import { describe, expect, it } from "vitest";
import { openaiChatAdapter } from "../src/adapters/openai-chat";
import { assembleFromFile } from "../src/core/assemble-from-file";
import { collectAsync } from "./helpers/collect-events";

const openAIStream = "test/fixtures/openai-chat/text-basic.sse";

describe("assembleFromFile extended edge cases", () => {
	it("LSA-T-EXT01: forwards maxBufferBytes to EventAssembler", async () => {
		await expect(
			collectAsync(
				assembleFromFile("test/fixtures/openai-chat/tool-single.sse", openaiChatAdapter(), {
					maxBufferBytes: 8,
				}),
			),
		).rejects.toThrow(/tool args buffer exceeded maxBufferBytes/);
	});

	it("LSA-T-EXT02: forwards sanitizeErrors to EventAssembler", async () => {
		const events = await collectAsync(
			assembleFromFile("test/fixtures/openai-chat/provider-error.sse", openaiChatAdapter(), {
				sanitizeErrors: true,
			}),
		);
		const error = events.find((event) => event.type === "error") as
			| Extract<(typeof events)[number], { type: "error" }>
			| undefined;
		expect(error?.sanitized).toBe("An error occurred while processing the stream.");
	});

	it("LSA-T-EXT03: replays full openai text-basic fixture end-to-end", async () => {
		const events = await collectAsync(assembleFromFile(openAIStream, openaiChatAdapter()));
		expect(events.at(-1)).toMatchObject({ type: "finish", reason: "stop" });
		expect(events.some((event) => event.type === "text.delta")).toBe(true);
	});
});
