import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { openaiChatAdapter } from "../src/adapters/openai-chat";
import { openaiResponsesAdapter } from "../src/adapters/openai-responses";
import { assembleStream } from "../src/core/assemble-stream";
import { alignLogprobsWithText } from "../src/helpers/align-logprobs-with-text";
import { collectStream } from "../src/transforms/collect-stream";
import { byteStreamFromStrings } from "./helpers/collect-events";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("align logprobs with text", () => {
	it("LSA-LPA01: single-token alignment extracts correct start/end", () => {
		const result = alignLogprobsWithText({
			assistantText: "Hello",
			logprobs: [{ token: "Hello", logprob: -0.1 }],
		});
		expect(result.entries).toEqual([
			{
				logprob: -0.1,
				token: "Hello",
				start: 0,
				end: 5,
				consistent: true,
			},
		]);
		expect(result.unaligned).toBe(0);
	});

	it("LSA-LPA02: multi-token stream aligns in order", () => {
		const result = alignLogprobsWithText({
			assistantText: "Hello!",
			logprobs: [
				{ token: "Hello", logprob: -0.12, position: 0 },
				{ token: "!", logprob: -0.006, position: 1 },
			],
		});
		expect(result.entries).toHaveLength(2);
		expect(result.entries[0]?.start).toBe(0);
		expect(result.entries[0]?.end).toBe(5);
		expect(result.entries[1]?.start).toBe(5);
		expect(result.entries[1]?.end).toBe(6);
		expect(result.unaligned).toBe(0);
	});

	it("LSA-LPA03: missing token in text increments unaligned", () => {
		const result = alignLogprobsWithText({
			assistantText: "Hi",
			logprobs: [{ token: "Hello", logprob: -0.1 }],
		});
		expect(result.entries).toEqual([]);
		expect(result.unaligned).toBe(1);
	});

	it("LSA-LPA04: unicode token preserved", () => {
		const result = alignLogprobsWithText({
			assistantText: "café",
			logprobs: [{ token: "é", logprob: -0.2 }],
		});
		expect(result.entries[0]?.token).toBe("é");
		expect(result.entries[0]?.consistent).toBe(true);
		expect(result.unaligned).toBe(0);
	});

	it("LSA-LPA05: repeated tokens align sequentially from cursor", () => {
		const result = alignLogprobsWithText({
			assistantText: "aa",
			logprobs: [
				{ token: "a", logprob: -0.1, position: 0 },
				{ token: "a", logprob: -0.2, position: 1 },
			],
		});
		expect(result.entries[0]?.start).toBe(0);
		expect(result.entries[1]?.start).toBe(1);
		expect(result.unaligned).toBe(0);
	});

	it("LSA-LPA06: empty assistantText marks all logprobs unaligned", () => {
		const result = alignLogprobsWithText({
			assistantText: "",
			logprobs: [{ token: "Hi", logprob: -0.1 }],
		});
		expect(result.entries).toEqual([]);
		expect(result.unaligned).toBe(1);
	});

	it("LSA-LPA07: empty logprobs array yields no entries", () => {
		const result = alignLogprobsWithText({
			assistantText: "Hello",
			logprobs: [],
		});
		expect(result.entries).toEqual([]);
		expect(result.unaligned).toBe(0);
	});

	it("LSA-LPA08: position field forwarded when present on input", () => {
		const result = alignLogprobsWithText({
			assistantText: "ab",
			logprobs: [{ token: "ab", logprob: -0.1, position: 7 }],
		});
		expect(result.entries[0]?.position).toBe(7);
	});

	it("LSA-LPA09: emoji grapheme aligns as single token", () => {
		const result = alignLogprobsWithText({
			assistantText: "Hi 👋",
			logprobs: [{ token: "👋", logprob: -0.3 }],
		});
		expect(result.entries[0]?.token).toBe("👋");
		expect(result.entries[0]?.consistent).toBe(true);
		expect(result.unaligned).toBe(0);
	});

	it("LSA-LPA10: token only found before cursor counts as unaligned", () => {
		const result = alignLogprobsWithText({
			assistantText: "abab",
			logprobs: [
				{ token: "ab", logprob: -0.1 },
				{ token: "ab", logprob: -0.2 },
				{ token: "ab", logprob: -0.3 },
			],
		});
		expect(result.entries).toHaveLength(2);
		expect(result.unaligned).toBe(1);
	});

	it("LSA-LPA11: leading whitespace in assistantText skipped by cursor alignment", () => {
		const result = alignLogprobsWithText({
			assistantText: "  hi",
			logprobs: [{ token: "hi", logprob: -0.1 }],
		});
		expect(result.entries[0]?.start).toBe(2);
		expect(result.entries[0]?.end).toBe(4);
	});

	it("LSA-LPA12: end-to-end on collected logprobs-stream text and logprobs", async () => {
		const sse = readFileSync(
			join(rootDir, "test/fixtures/openai-chat/logprobs-stream.sse"),
			"utf8",
		);
		const collected = await collectStream(
			(async function* () {
				for await (const event of assembleStream(byteStreamFromStrings(sse), openaiChatAdapter())) {
					yield event;
				}
			})(),
		);
		const result = alignLogprobsWithText({
			assistantText: collected.text,
			logprobs: collected.logprobs.map((event) => ({
				token: event.token,
				logprob: event.logprob,
				position: event.position,
				channel: event.channel,
			})),
		});
		expect(result.unaligned).toBe(0);
		expect(result.entries.length).toBe(collected.logprobs.length);
	});

	it("LSA-LPA13: end-to-end on Responses logprobs-stream collected output", async () => {
		const sse = readFileSync(
			join(rootDir, "test/fixtures/openai-responses/logprobs-stream.sse"),
			"utf8",
		);
		const collected = await collectStream(
			assembleStream(byteStreamFromStrings(sse), openaiResponsesAdapter()),
		);
		const result = alignLogprobsWithText({
			assistantText: collected.text,
			logprobs: collected.logprobs.map((event) => ({
				token: event.token,
				logprob: event.logprob,
				position: event.position,
				channel: event.channel,
			})),
		});
		expect(result.unaligned).toBe(0);
		expect(result.entries.length).toBe(2);
	});
});
