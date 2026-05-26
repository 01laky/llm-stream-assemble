import { describe, expect, it } from "vitest";
import { openaiCompatibleAdapter } from "../src/adapters/openai-compatible";
import { assembleResponse } from "../src/core/assemble-response";
import { assembleStream } from "../src/core/assemble-stream";
import { byteStreamFromStrings, collectAsync } from "./helpers/collect-events";
import {
	expectedHostCompatibleEvents,
	hostCompatibleFixture,
	HOST_COMPATIBLE_PRESETS,
	normalizeCompatibleEvents,
} from "./helpers/compatible-fixtures";

type HostPreset = (typeof HOST_COMPATIBLE_PRESETS)[number];

async function streamHostFixture(host: HostPreset, name: string) {
	return normalizeCompatibleEvents(
		await collectAsync(
			assembleStream(
				byteStreamFromStrings(hostCompatibleFixture(host, name, "sse") as string),
				openaiCompatibleAdapter({ provider: host }),
			),
		),
	);
}

function responseHostFixture(host: HostPreset, name: string) {
	return normalizeCompatibleEvents(
		assembleResponse(
			hostCompatibleFixture(host, name, "json"),
			openaiCompatibleAdapter({ provider: host }),
		),
	);
}

describe("openaiCompatibleAdapter host preset golden fixtures", () => {
	it("LSA-OC47: groq/text-basic.sse matches expected events", async () => {
		await expect(streamHostFixture("groq", "text-basic")).resolves.toEqual(
			expectedHostCompatibleEvents("groq", "text-basic"),
		);
	});

	it("LSA-OC48: groq/missing-tool-id.sse matches expected events", async () => {
		await expect(streamHostFixture("groq", "missing-tool-id")).resolves.toEqual(
			expectedHostCompatibleEvents("groq", "missing-tool-id"),
		);
	});

	it("LSA-OC49: deepseek/text-basic.sse matches expected events", async () => {
		await expect(streamHostFixture("deepseek", "text-basic")).resolves.toEqual(
			expectedHostCompatibleEvents("deepseek", "text-basic"),
		);
	});

	it("LSA-OC50: deepseek/reasoning-stream.sse matches expected events", async () => {
		await expect(streamHostFixture("deepseek", "reasoning-stream")).resolves.toEqual(
			expectedHostCompatibleEvents("deepseek", "reasoning-stream"),
		);
	});

	it("LSA-OC51: deepseek/tool-single.sse matches expected events", async () => {
		await expect(streamHostFixture("deepseek", "tool-single")).resolves.toEqual(
			expectedHostCompatibleEvents("deepseek", "tool-single"),
		);
	});

	it("LSA-OC52: deepseek/provider-error.sse matches expected events", async () => {
		await expect(streamHostFixture("deepseek", "provider-error")).resolves.toEqual(
			expectedHostCompatibleEvents("deepseek", "provider-error"),
		);
	});

	it("LSA-OC53: mistral/text-basic.sse matches expected events", async () => {
		await expect(streamHostFixture("mistral", "text-basic")).resolves.toEqual(
			expectedHostCompatibleEvents("mistral", "text-basic"),
		);
	});

	it("LSA-OC54: mistral/tool-parallel.sse matches expected events", async () => {
		await expect(streamHostFixture("mistral", "tool-parallel")).resolves.toEqual(
			expectedHostCompatibleEvents("mistral", "tool-parallel"),
		);
	});

	it("LSA-OC55: ollama/text-basic.sse matches expected events", async () => {
		await expect(streamHostFixture("ollama", "text-basic")).resolves.toEqual(
			expectedHostCompatibleEvents("ollama", "text-basic"),
		);
	});

	it("LSA-OC56: ollama/tool-missing-id.sse matches expected events", async () => {
		await expect(streamHostFixture("ollama", "tool-missing-id")).resolves.toEqual(
			expectedHostCompatibleEvents("ollama", "tool-missing-id"),
		);
	});

	it("LSA-OC57: lmstudio/text-basic.sse matches expected events", async () => {
		await expect(streamHostFixture("lmstudio", "text-basic")).resolves.toEqual(
			expectedHostCompatibleEvents("lmstudio", "text-basic"),
		);
	});

	it("LSA-OC58: lmstudio/missing-metadata.sse matches expected events", async () => {
		await expect(streamHostFixture("lmstudio", "missing-metadata")).resolves.toEqual(
			expectedHostCompatibleEvents("lmstudio", "missing-metadata"),
		);
	});

	it("LSA-OC59: together/text-basic.sse matches expected events", async () => {
		await expect(streamHostFixture("together", "text-basic")).resolves.toEqual(
			expectedHostCompatibleEvents("together", "text-basic"),
		);
	});

	it("LSA-OC60: together/reasoning-alias.sse matches expected events", async () => {
		await expect(streamHostFixture("together", "reasoning-alias")).resolves.toEqual(
			expectedHostCompatibleEvents("together", "reasoning-alias"),
		);
	});

	it("LSA-OC61: fireworks/text-basic.sse matches expected events", async () => {
		await expect(streamHostFixture("fireworks", "text-basic")).resolves.toEqual(
			expectedHostCompatibleEvents("fireworks", "text-basic"),
		);
	});

	it("LSA-OC62: fireworks/tool-single.sse matches expected events", async () => {
		await expect(streamHostFixture("fireworks", "tool-single")).resolves.toEqual(
			expectedHostCompatibleEvents("fireworks", "tool-single"),
		);
	});

	it("LSA-OC63: openrouter/text-basic.sse matches expected events", async () => {
		await expect(streamHostFixture("openrouter", "text-basic")).resolves.toEqual(
			expectedHostCompatibleEvents("openrouter", "text-basic"),
		);
	});

	it("LSA-OC64: openrouter/router-metadata.sse matches expected events", async () => {
		await expect(streamHostFixture("openrouter", "router-metadata")).resolves.toEqual(
			expectedHostCompatibleEvents("openrouter", "router-metadata"),
		);
	});

	it("LSA-OC65: groq/response-basic.json matches expected events", () => {
		expect(responseHostFixture("groq", "response-basic")).toEqual(
			expectedHostCompatibleEvents("groq", "response-basic"),
		);
	});

	it("LSA-OC66: deepseek/response-basic.json matches expected events", () => {
		expect(responseHostFixture("deepseek", "response-basic")).toEqual(
			expectedHostCompatibleEvents("deepseek", "response-basic"),
		);
	});

	it("LSA-OC87: perplexity/text-basic.sse matches expected events", async () => {
		await expect(streamHostFixture("perplexity", "text-basic")).resolves.toEqual(
			expectedHostCompatibleEvents("perplexity", "text-basic"),
		);
	});

	it("LSA-OC88: perplexity/citations-stream.sse matches expected events", async () => {
		await expect(streamHostFixture("perplexity", "citations-stream")).resolves.toEqual(
			expectedHostCompatibleEvents("perplexity", "citations-stream"),
		);
	});

	it("LSA-OC89: perplexity/missing-metadata.sse matches expected events", async () => {
		await expect(streamHostFixture("perplexity", "missing-metadata")).resolves.toEqual(
			expectedHostCompatibleEvents("perplexity", "missing-metadata"),
		);
	});

	it("LSA-OC90: perplexity/response-citations.json matches expected events", () => {
		expect(responseHostFixture("perplexity", "response-citations")).toEqual(
			expectedHostCompatibleEvents("perplexity", "response-citations"),
		);
	});

	it("LSA-OC91: xai/text-basic.sse matches expected events", async () => {
		await expect(streamHostFixture("xai", "text-basic")).resolves.toEqual(
			expectedHostCompatibleEvents("xai", "text-basic"),
		);
	});

	it("LSA-OC92: xai/tool-single.sse matches expected events", async () => {
		await expect(streamHostFixture("xai", "tool-single")).resolves.toEqual(
			expectedHostCompatibleEvents("xai", "tool-single"),
		);
	});

	it("LSA-OC93: xai/missing-metadata.sse matches expected events", async () => {
		await expect(streamHostFixture("xai", "missing-metadata")).resolves.toEqual(
			expectedHostCompatibleEvents("xai", "missing-metadata"),
		);
	});

	it("LSA-OC94: xai/response-basic.json matches expected events", () => {
		expect(responseHostFixture("xai", "response-basic")).toEqual(
			expectedHostCompatibleEvents("xai", "response-basic"),
		);
	});

	it("LSA-OC108: perplexity/provider-error.sse matches expected events", async () => {
		await expect(streamHostFixture("perplexity", "provider-error")).resolves.toEqual(
			expectedHostCompatibleEvents("perplexity", "provider-error"),
		);
	});

	it("LSA-OC109: xai/reasoning-stream.sse matches expected events", async () => {
		await expect(streamHostFixture("xai", "reasoning-stream")).resolves.toEqual(
			expectedHostCompatibleEvents("xai", "reasoning-stream"),
		);
	});
});
