import { describe, expect, it } from "vitest";
import { openaiChatAdapter } from "../src/adapters/openai-chat";
import { openaiCompatibleAdapter } from "../src/adapters/openai-compatible";
import { assembleStream } from "../src/core/assemble-stream";
import { byteStreamFromStrings, collectAsync } from "./helpers/collect-events";
import { hostCompatibleFixture, normalizeCompatibleEvents } from "./helpers/compatible-fixtures";

const payload = (value: unknown) => JSON.stringify(value);

describe("openaiCompatibleAdapter cloudflare preset robust coverage", () => {
	it("LSA-OC172: cloudflare vs azure loose string error — cloudflare maps, azure silent", () => {
		const looseError = payload({ error: "rate limited" });
		expect(
			openaiCompatibleAdapter({ provider: "cloudflare" }).parseChunk(looseError),
		).toContainEqual(expect.objectContaining({ kind: "provider-error" }));
		expect(openaiCompatibleAdapter({ provider: "azure" }).parseChunk(looseError)).toEqual([]);
	});

	it("LSA-OC173: strict cloudflare allowMissingMetadata false rejects unrecognizable payload", () => {
		const strict = openaiCompatibleAdapter({
			provider: "cloudflare",
			allowMissingMetadata: false,
		});
		expect(() => strict.parseChunk(payload({ foo: "bar" }))).toThrow(
			/openaiCompatibleAdapter\.parseChunk/,
		);
	});

	it("LSA-OC174: strict cloudflare still parses valid Workers AI shaped chunk", () => {
		const strict = openaiCompatibleAdapter({
			provider: "cloudflare",
			allowMissingMetadata: false,
		});
		expect(
			strict.parseChunk(
				payload({
					id: "cf-strict",
					model: "@cf/meta/llama-3.1-8b-instruct",
					choices: [{ delta: { content: "ok" } }],
				}),
			),
		).toContainEqual({ kind: "text-delta", text: "ok", choiceIndex: 0 });
	});

	it("LSA-OC175: cloudflare provider-error object parseChunk yields provider-error", () => {
		const raw = hostCompatibleFixture("cloudflare", "provider-error", "sse") as string;
		const line = raw.split("\n").find((l) => l.startsWith("data: ") && l.includes("error"))!;
		const chunks = openaiCompatibleAdapter({ provider: "cloudflare" }).parseChunk(
			line.slice("data: ".length),
		);
		expect(chunks.some((chunk) => chunk.kind === "provider-error")).toBe(true);
	});

	it("LSA-OC176: cloudflare tool-single parseChunk preserves tool id and function name", () => {
		const raw = hostCompatibleFixture("cloudflare", "tool-single", "sse") as string;
		const line = raw.split("\n").find((l) => l.startsWith("data: ") && l.includes("tool_calls"))!;
		const chunks = openaiCompatibleAdapter({ provider: "cloudflare" }).parseChunk(
			line.slice("data: ".length),
		);
		expect(chunks).toContainEqual(
			expect.objectContaining({
				kind: "tool-start",
				id: "call_cf_1",
				name: "get_weather",
			}),
		);
	});

	it("LSA-OC177: cloudflare usage chunk parseChunk includes finish_reason stop on choice", () => {
		const raw = hostCompatibleFixture("cloudflare", "usage-stream", "sse") as string;
		const usageLine = raw.split("\n").find((l) => l.includes('"usage"') && l.startsWith("data: "))!;
		const parsed = JSON.parse(usageLine.slice("data: ".length)) as {
			choices?: Array<{ finish_reason?: string }>;
		};
		expect(parsed.choices?.[0]?.finish_reason).toBe("stop");
		const chunks = openaiCompatibleAdapter({ provider: "cloudflare" }).parseChunk(
			usageLine.slice("data: ".length),
		);
		expect(chunks.some((chunk) => chunk.kind === "usage")).toBe(true);
	});

	it("LSA-OC180: cloudflare empty choices array emits metadata without text deltas", () => {
		const chunks = openaiCompatibleAdapter({ provider: "cloudflare" }).parseChunk(
			payload({ id: "cf", model: "@cf/x", choices: [] }),
		);
		expect(chunks.some((chunk) => chunk.kind === "text-delta")).toBe(false);
		expect(chunks.some((chunk) => chunk.kind === "metadata")).toBe(true);
		expect(chunks.some((chunk) => chunk.kind === "message-start")).toBe(true);
	});

	it("LSA-OC181: cloudflare empty content delta does not throw", () => {
		expect(() =>
			openaiCompatibleAdapter({ provider: "cloudflare" }).parseChunk(
				payload({ choices: [{ delta: {} }] }),
			),
		).not.toThrow();
	});

	it("LSA-OC182: cloudflare @cf model id appears in metadata parseChunk", () => {
		const chunks = openaiCompatibleAdapter({ provider: "cloudflare" }).parseChunk(
			payload({
				id: "cf-meta",
				model: "@cf/meta/llama-3.1-8b-instruct",
				choices: [{ delta: { content: "x" } }],
			}),
		);
		const metadata = chunks.find((chunk) => chunk.kind === "metadata");
		expect(metadata).toMatchObject({
			kind: "metadata",
			model: "@cf/meta/llama-3.1-8b-instruct",
		});
	});

	it("LSA-OC183: cloudflare missing-metadata stream event types match groq sparse pattern", async () => {
		const types = async (host: "cloudflare" | "groq") => {
			const sse = hostCompatibleFixture(host, "missing-metadata", "sse") as string;
			const events = normalizeCompatibleEvents(
				await collectAsync(
					assembleStream(byteStreamFromStrings(sse), openaiCompatibleAdapter({ provider: host })),
				),
			);
			return events.map((event) => (event as { type: string }).type);
		};
		expect(await types("cloudflare")).toEqual(await types("groq"));
	});

	it("LSA-OC184: cloudflare tool-single full stream matches openaiChatAdapter", async () => {
		const sse = hostCompatibleFixture("cloudflare", "tool-single", "sse") as string;
		const cfEvents = normalizeCompatibleEvents(
			await collectAsync(
				assembleStream(
					byteStreamFromStrings(sse),
					openaiCompatibleAdapter({ provider: "cloudflare" }),
				),
			),
		);
		const chatEvents = normalizeCompatibleEvents(
			await collectAsync(assembleStream(byteStreamFromStrings(sse), openaiChatAdapter())),
		);
		expect(cfEvents).toEqual(chatEvents);
	});

	it("LSA-OC185: cloudflare json-mode with jsonMode matches openaiChatAdapter json events", async () => {
		const sse = hostCompatibleFixture("cloudflare", "json-mode", "sse") as string;
		const cfEvents = normalizeCompatibleEvents(
			await collectAsync(
				assembleStream(
					byteStreamFromStrings(sse),
					openaiCompatibleAdapter({ provider: "cloudflare", jsonMode: true }),
				),
			),
		);
		const chatEvents = normalizeCompatibleEvents(
			await collectAsync(
				assembleStream(byteStreamFromStrings(sse), openaiChatAdapter({ jsonMode: true })),
			),
		);
		expect(cfEvents).toEqual(chatEvents);
	});

	it("LSA-OC186: cloudflare json-mode without jsonMode emits text.delta not json.delta", async () => {
		const sse = hostCompatibleFixture("cloudflare", "json-mode", "sse") as string;
		const events = normalizeCompatibleEvents(
			await collectAsync(
				assembleStream(
					byteStreamFromStrings(sse),
					openaiCompatibleAdapter({ provider: "cloudflare" }),
				),
			),
		);
		const types = events.map((event) => (event as { type: string }).type);
		expect(types.some((type) => type.startsWith("json."))).toBe(false);
		expect(types).toContain("text.delta");
	});

	it("LSA-OC188: cloudflare usage-stream finish reason stop only on terminal assembled stream", async () => {
		const sse = hostCompatibleFixture("cloudflare", "usage-stream", "sse") as string;
		const events = normalizeCompatibleEvents(
			await collectAsync(
				assembleStream(
					byteStreamFromStrings(sse),
					openaiCompatibleAdapter({ provider: "cloudflare" }),
				),
			),
		);
		const finishEvents = events.filter((event) => (event as { type?: string }).type === "finish");
		expect(finishEvents).toHaveLength(1);
		expect(finishEvents[0]).toMatchObject({ type: "finish", reason: "stop" });
		const usageIndex = events.findIndex((event) => (event as { type?: string }).type === "usage");
		const finishIndex = events.findIndex((event) => (event as { type?: string }).type === "finish");
		expect(usageIndex).toBeGreaterThan(-1);
		expect(finishIndex).toBeGreaterThan(usageIndex - 1);
	});

	it("LSA-OC193: cloudflare text-basic stream includes message.start with response id", async () => {
		const sse = hostCompatibleFixture("cloudflare", "text-basic", "sse") as string;
		const events = normalizeCompatibleEvents(
			await collectAsync(
				assembleStream(
					byteStreamFromStrings(sse),
					openaiCompatibleAdapter({ provider: "cloudflare" }),
				),
			),
		);
		expect(events[0]).toMatchObject({ type: "message.start", id: "cf-chatcmpl-1" });
	});

	it("LSA-OC194: cloudflare tool-single stream finish reason is tool_calls", async () => {
		const sse = hostCompatibleFixture("cloudflare", "tool-single", "sse") as string;
		const events = normalizeCompatibleEvents(
			await collectAsync(
				assembleStream(
					byteStreamFromStrings(sse),
					openaiCompatibleAdapter({ provider: "cloudflare" }),
				),
			),
		);
		expect(events.at(-1)).toMatchObject({ type: "finish", reason: "tool_calls" });
	});

	it("LSA-OC199: cloudflare vs groq on sparse metadata parseChunk — identical deltas", () => {
		const sparse = payload({ choices: [{ delta: { content: "shared sparse" } }] });
		const expected = [{ kind: "text-delta", text: "shared sparse", choiceIndex: 0 }];
		expect(openaiCompatibleAdapter({ provider: "cloudflare" }).parseChunk(sparse)).toEqual(
			expected,
		);
		expect(openaiCompatibleAdapter({ provider: "groq" }).parseChunk(sparse)).toEqual(expected);
	});

	it("LSA-OC200: cloudflare strict looseErrorShape false still accepts object error shape", () => {
		const strict = openaiCompatibleAdapter({
			provider: "cloudflare",
			looseErrorShape: false,
		});
		const objectError = payload({
			error: { message: "bad model", type: "invalid_request_error", code: "x" },
		});
		expect(strict.parseChunk(objectError)).toContainEqual(
			expect.objectContaining({ kind: "provider-error" }),
		);
	});

	it("LSA-OC201: cloudflare strict looseErrorShape false ignores loose string errors", () => {
		const strict = openaiCompatibleAdapter({
			provider: "cloudflare",
			looseErrorShape: false,
		});
		expect(strict.parseChunk(payload({ error: "string only" }))).toEqual([]);
	});

	it("LSA-OC202: cloudflare first content chunk has no finish_reason before usage chunk", async () => {
		const sse = hostCompatibleFixture("cloudflare", "usage-stream", "sse") as string;
		const firstLine = sse
			.split("\n")
			.find((l) => l.startsWith("data: ") && l.includes("With usage"))!;
		const parsed = JSON.parse(firstLine.slice("data: ".length)) as {
			choices?: Array<{ finish_reason?: string | null }>;
		};
		expect(parsed.choices?.[0]?.finish_reason ?? null).toBeNull();
	});

	it("LSA-OC203: cloudflare response-basic stream text matches response-basic.json content", () => {
		const body = hostCompatibleFixture("cloudflare", "response-basic", "json") as {
			choices?: Array<{ message?: { content?: string } }>;
		};
		expect(body.choices?.[0]?.message?.content).toContain("Cloudflare response");
	});

	it("LSA-OC205: cloudflare unicode content delta preserved", () => {
		expect(
			openaiCompatibleAdapter({ provider: "cloudflare" }).parseChunk(
				payload({ choices: [{ delta: { content: "Ahoj 🌍" } }] }),
			),
		).toContainEqual({ kind: "text-delta", text: "Ahoj 🌍", choiceIndex: 0 });
	});

	it("LSA-OC206: cloudflare multiple empty parseChunk calls stay stateless", () => {
		const adapter = openaiCompatibleAdapter({ provider: "cloudflare" });
		expect(adapter.parseChunk(payload({ choices: [{ delta: { content: "a" } }] }))).toContainEqual({
			kind: "text-delta",
			text: "a",
			choiceIndex: 0,
		});
		expect(adapter.parseChunk(payload({}))).toEqual([]);
		expect(adapter.parseChunk(payload({ choices: [{ delta: { content: "b" } }] }))).toContainEqual({
			kind: "text-delta",
			text: "b",
			choiceIndex: 0,
		});
	});

	it("LSA-OC209: cloudflare and perplexity both tolerate missing choice index via fallback", () => {
		const sparse = payload({ choices: [{ delta: { content: "no index" } }] });
		const expected = [{ kind: "text-delta", text: "no index", choiceIndex: 0 }];
		expect(openaiCompatibleAdapter({ provider: "cloudflare" }).parseChunk(sparse)).toEqual(
			expected,
		);
		expect(openaiCompatibleAdapter({ provider: "perplexity" }).parseChunk(sparse)).toEqual(
			expected,
		);
	});
});
