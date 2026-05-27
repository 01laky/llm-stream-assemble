import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { anthropicAdapter } from "../src/adapters/anthropic";
import { bedrockAdapter } from "../src/adapters/bedrock";
import { geminiAdapter } from "../src/adapters/gemini";
import { openaiChatAdapter } from "../src/adapters/openai-chat";
import { openaiCompatibleAdapter } from "../src/adapters/openai-compatible";
import { cohereAdapter } from "../src/adapters/cohere";
import { openaiResponsesAdapter } from "../src/adapters/openai-responses";
import { assembleFromFile } from "../src/core/assemble-from-file";
import { assembleFromPayloads } from "../src/core/assemble-payloads";
import { assembleStream } from "../src/core/assemble-stream";
import { isLogprob } from "../src/helpers/type-guards";
import { collectStream } from "../src/transforms/collect-stream";
import { tapEvents } from "../src/transforms/tap-events";
import { runAdapterGoldenStream } from "./helpers/adapter-conformance";
import { byteStreamFromStrings, collectAsync, strings } from "./helpers/collect-events";
import { expectedOpenAIEvents, normalizeEvents } from "./helpers/openai-fixtures";
import { normalizeResponsesEvents, responsesTextFixture } from "./helpers/responses-fixtures";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const openaiFixtures = join(rootDir, "test/fixtures/openai-chat");
const responsesFixtures = join(rootDir, "test/fixtures/openai-responses");

const payload = (value: unknown) => JSON.stringify(value);

describe("cross-adapter assembler edge cases", () => {
	it.each([
		[
			"LSA-X58",
			"bedrock",
			bedrockAdapter(),
			async function* () {
				yield payload({ messageStart: { role: "assistant" } });
				yield payload({
					contentBlockDelta: { contentBlockIndex: 0, delta: { text: "a" } },
				});
				yield payload({ messageStop: { stopReason: "end_turn" } });
				yield payload({ metadata: { trace: { late: true } } });
			},
		],
		[
			"LSA-X59",
			"anthropic",
			anthropicAdapter(),
			async function* () {
				yield payload({
					type: "content_block_delta",
					index: 0,
					delta: { type: "text_delta", text: "a" },
				});
				yield payload({ type: "message_delta", delta: { stop_reason: "end_turn" } });
				yield payload({ type: "message_delta", usage: { input_tokens: 1, output_tokens: 1 } });
			},
		],
		[
			"LSA-X60",
			"gemini",
			geminiAdapter(),
			async function* () {
				yield payload({
					candidates: [{ index: 0, content: { parts: [{ text: "a" }] } }],
				});
				yield payload({
					candidates: [{ index: 0, finishReason: "STOP", content: { parts: [] } }],
				});
				yield payload({ usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1 } });
			},
		],
		[
			"LSA-X61",
			"openai-responses",
			openaiResponsesAdapter(),
			async function* () {
				yield payload({ type: "response.output_text.delta", delta: "a" });
				yield payload({ type: "response.completed", response: {} });
				yield payload({ type: "response.output_text.delta", delta: "late" });
			},
		],
		[
			"LSA-X62",
			"openai-chat",
			openaiChatAdapter(),
			async function* () {
				yield payload({
					id: "cmpl",
					object: "chat.completion.chunk",
					choices: [{ index: 0, delta: { content: "a" }, finish_reason: null }],
				});
				yield payload({
					id: "cmpl",
					object: "chat.completion.chunk",
					choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
				});
				yield payload({
					id: "cmpl",
					object: "chat.completion.chunk",
					choices: [{ index: 0, delta: { content: "late" }, finish_reason: null }],
				});
			},
		],
		[
			"LSA-X63",
			"cohere",
			cohereAdapter(),
			async function* () {
				yield payload({
					type: "message-start",
					id: "m1",
					delta: { message: { role: "assistant" } },
				});
				yield payload({
					type: "content-delta",
					index: 0,
					delta: { message: { content: { text: "a" } } },
				});
				yield payload({
					type: "message-end",
					delta: { finish_reason: "COMPLETE" },
				});
				yield payload({
					type: "citation-start",
					index: 0,
					delta: { message: { citations: { text: "late" } } },
				});
			},
		],
		[
			"LSA-X64",
			"gemini-vertex",
			geminiAdapter({ apiSurface: "vertex" }),
			async function* () {
				yield payload({
					responseId: "v1",
					candidates: [{ index: 0, content: { role: "model", parts: [{ text: "a" }] } }],
				});
				yield payload({
					candidates: [{ index: 0, finishReason: "STOP", content: { role: "model", parts: [] } }],
				});
				yield payload({ usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1 } });
			},
		],
	])(
		"%s: %s drops post-finish adapter chunks during assembly",
		async (_id, _name, adapter, payloads) => {
			const events = await collectAsync(assembleFromPayloads(payloads(), adapter));
			expect(events.some((event) => event.type === "finish")).toBe(true);
			const textEvents = events.filter((event) => event.type === "text.delta");
			expect(textEvents.length).toBeLessThanOrEqual(1);
			if (textEvents[0]?.type === "text.delta") {
				expect(textEvents[0].text).not.toContain("late");
			}
		},
	);

	it.each([
		[
			"LSA-X65",
			openaiChatAdapter({ jsonMode: true }),
			async function* () {
				yield payload({
					id: "cmpl",
					object: "chat.completion.chunk",
					choices: [{ index: 0, delta: { content: '{"a":1}' }, finish_reason: null }],
				});
				yield payload({
					id: "cmpl",
					object: "chat.completion.chunk",
					choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
				});
				yield payload({
					id: "cmpl",
					object: "chat.completion.chunk",
					choices: [{ index: 0, delta: { content: '{"late":true}' }, finish_reason: null }],
				});
			},
		],
		[
			"LSA-X66",
			openaiResponsesAdapter({ jsonMode: true }),
			async function* () {
				yield payload({ type: "response.output_text.delta", delta: '{"x":1}' });
				yield payload({ type: "response.completed", response: {} });
				yield payload({ type: "response.output_text.delta", delta: '{"late":true}' });
			},
		],
		[
			"LSA-X67",
			anthropicAdapter({ jsonMode: true }),
			async function* () {
				yield payload({
					type: "content_block_delta",
					index: 0,
					delta: { type: "text_delta", text: '{"a":1}' },
				});
				yield payload({ type: "message_delta", delta: { stop_reason: "end_turn" } });
				yield payload({
					type: "content_block_delta",
					index: 0,
					delta: { type: "text_delta", text: '{"late":true}' },
				});
			},
		],
		[
			"LSA-X68",
			cohereAdapter({ jsonMode: true }),
			async function* () {
				yield payload({
					type: "message-start",
					id: "m1",
					delta: { message: { role: "assistant" } },
				});
				yield payload({
					type: "content-delta",
					index: 0,
					delta: { message: { content: { text: '{"a":1}' } } },
				});
				yield payload({
					type: "message-end",
					delta: { finish_reason: "COMPLETE" },
				});
				yield payload({
					type: "content-delta",
					index: 0,
					delta: { message: { content: { text: '{"late":true}' } } },
				});
			},
		],
		[
			"LSA-X69",
			bedrockAdapter({ jsonMode: true }),
			async function* () {
				yield payload({ messageStart: { role: "assistant" } });
				yield payload({
					contentBlockDelta: { contentBlockIndex: 0, delta: { text: '{"a":1}' } },
				});
				yield payload({ messageStop: { stopReason: "end_turn" } });
				yield payload({
					contentBlockDelta: { contentBlockIndex: 0, delta: { text: '{"late":true}' } },
				});
			},
		],
		[
			"LSA-X70",
			geminiAdapter({ jsonMode: true }),
			async function* () {
				yield payload({
					candidates: [{ index: 0, content: { parts: [{ text: '{"a":1}' }] } }],
				});
				yield payload({
					candidates: [{ index: 0, finishReason: "STOP", content: { parts: [] } }],
				});
				yield payload({
					candidates: [{ index: 0, content: { parts: [{ text: '{"late":true}' }] } }],
				});
			},
		],
	])("%s: jsonMode drops post-finish json deltas", async (_id, adapter, payloads) => {
		const events = await collectAsync(assembleFromPayloads(payloads(), adapter));
		expect(events.some((event) => event.type === "finish")).toBe(true);
		expect(
			events.some((event) => event.type === "json.delta" && event.delta.includes("late")),
		).toBe(false);
		expect(events.filter((event) => event.type === "json.delta").length).toBeLessThanOrEqual(1);
	});

	it("LSA-X71: strictToolArgs throws on invalid OpenAI Chat tool JSON at stream end", async () => {
		async function* payloads() {
			yield payload({
				id: "cmpl",
				object: "chat.completion.chunk",
				choices: [
					{
						index: 0,
						delta: {
							tool_calls: [{ index: 0, id: "call_1", function: { name: "fn", arguments: "{" } }],
						},
						finish_reason: null,
					},
				],
			});
			yield payload({
				id: "cmpl",
				object: "chat.completion.chunk",
				choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }],
			});
		}
		await expect(
			collectAsync(assembleFromPayloads(payloads(), openaiChatAdapter(), { strictToolArgs: true })),
		).rejects.toThrow(/^llm-stream-assemble:/);
	});

	it("LSA-X72: strictToolArgs throws on invalid Anthropic tool input at stream end", async () => {
		async function* payloads() {
			yield payload({
				type: "content_block_start",
				index: 0,
				content_block: { type: "tool_use", id: "toolu_1", name: "get_weather" },
			});
			yield payload({
				type: "content_block_delta",
				index: 0,
				delta: { type: "input_json_delta", partial_json: "{" },
			});
			yield payload({ type: "message_delta", delta: { stop_reason: "tool_use" } });
		}
		await expect(
			collectAsync(assembleFromPayloads(payloads(), anthropicAdapter(), { strictToolArgs: true })),
		).rejects.toThrow(/^llm-stream-assemble:/);
	});

	it("LSA-X73: strictToolArgs throws on invalid Bedrock tool input at stream end", async () => {
		async function* payloads() {
			yield payload({
				contentBlockStart: {
					contentBlockIndex: 0,
					start: { toolUse: { toolUseId: "t1", name: "search" } },
				},
			});
			yield payload({
				contentBlockDelta: {
					contentBlockIndex: 0,
					delta: { toolUse: { input: "{" } },
				},
			});
			yield payload({ contentBlockStop: { contentBlockIndex: 0 } });
			yield payload({ messageStop: { stopReason: "tool_use" } });
		}
		await expect(
			collectAsync(assembleFromPayloads(payloads(), bedrockAdapter(), { strictToolArgs: true })),
		).rejects.toThrow(/^llm-stream-assemble:/);
	});

	it("LSA-X74: strictToolArgs throws on invalid Cohere tool args at stream end", async () => {
		async function* payloads() {
			yield payload({
				type: "message-start",
				id: "m1",
				delta: { message: { role: "assistant" } },
			});
			yield payload({
				type: "tool-call-start",
				index: 0,
				delta: {
					message: {
						tool_calls: {
							type: "function",
							function: { name: "fn", arguments: "" },
						},
					},
				},
			});
			yield payload({
				type: "tool-call-delta",
				index: 0,
				delta: {
					message: {
						tool_calls: {
							function: { arguments: "{" },
						},
					},
				},
			});
			yield payload({ type: "tool-call-end", index: 0 });
			yield payload({
				type: "message-end",
				delta: { finish_reason: "TOOL_CALL" },
			});
		}
		await expect(
			collectAsync(assembleFromPayloads(payloads(), cohereAdapter(), { strictToolArgs: true })),
		).rejects.toThrow(/^llm-stream-assemble:/);
	});

	it("LSA-X75: strictToolArgs throws on invalid Gemini functionCall args at stream end", async () => {
		async function* payloads() {
			yield payload({
				candidates: [
					{
						index: 0,
						content: {
							parts: [
								{
									functionCall: {
										name: "fn",
										partialArgs: [{ json: "{" }],
									},
								},
							],
						},
					},
				],
			});
			yield payload({
				candidates: [{ index: 0, finishReason: "STOP", content: { parts: [] } }],
			});
		}
		await expect(
			collectAsync(assembleFromPayloads(payloads(), geminiAdapter(), { strictToolArgs: true })),
		).rejects.toThrow(/^llm-stream-assemble:/);
	});

	it("LSA-X76: strictToolArgs throws on invalid OpenAI Responses tool args at stream end", async () => {
		async function* payloads() {
			yield payload({
				type: "response.output_item.added",
				output_index: 0,
				item: { type: "function_call", id: "call_x", name: "search", call_id: "call_x" },
			});
			yield payload({
				type: "response.function_call_arguments.delta",
				output_index: 0,
				call_id: "call_x",
				delta: "{",
			});
			yield payload({ type: "response.completed", response: {} });
		}
		await expect(
			collectAsync(
				assembleFromPayloads(payloads(), openaiResponsesAdapter(), { strictToolArgs: true }),
			),
		).rejects.toThrow(/^llm-stream-assemble:/);
	});

	it("LSA-X77: Gemini post-finish grounding dropped", async () => {
		async function* payloads() {
			yield payload({
				candidates: [{ index: 0, finishReason: "STOP", content: { parts: [] } }],
			});
			yield payload({
				candidates: [
					{
						index: 0,
						groundingMetadata: { webSearchQueries: ["late"] },
						content: { parts: [] },
					},
				],
			});
		}
		const events = await collectAsync(assembleFromPayloads(payloads(), geminiAdapter()));
		expect(events.some((event) => event.type === "grounding")).toBe(false);
	});

	it("LSA-X78: Perplexity-compatible post-finish citation dropped", async () => {
		const { openaiCompatibleAdapter } = await import("../src/adapters/openai-compatible");
		async function* payloads() {
			yield payload({
				choices: [{ delta: { content: "done" }, finish_reason: "stop" }],
			});
			yield payload({ citations: ["https://late.test"] });
		}
		const events = await collectAsync(
			assembleFromPayloads(payloads(), openaiCompatibleAdapter({ provider: "perplexity" })),
		);
		expect(events.some((event) => event.type === "citation")).toBe(false);
	});

	it("LSA-X79: strictToolArgs unaffected when citation events present", async () => {
		async function* payloads() {
			yield payload({
				type: "citation-start",
				index: 0,
				delta: { message: { citations: { start: 0, end: 1, text: "a" } } },
			});
			yield payload({
				type: "tool-call-start",
				index: 0,
				delta: {
					message: {
						tool_calls: {
							id: "tool_x",
							type: "function",
							function: { name: "fn", arguments: "" },
						},
					},
				},
			});
			yield payload({
				type: "tool-call-delta",
				index: 0,
				delta: { message: { tool_calls: { function: { arguments: "{}" } } } },
			});
			yield payload({ type: "message-end", delta: { finish_reason: "COMPLETE" } });
		}
		const events = await collectAsync(
			assembleFromPayloads(payloads(), cohereAdapter(), { strictToolArgs: true }),
		);
		expect(events.some((event) => event.type === "citation")).toBe(true);
		expect(events.some((event) => event.type === "tool_call.done")).toBe(true);
	});

	it("LSA-X80: jsonMode and grounding interleave on Gemini", async () => {
		async function* payloads() {
			yield payload({
				candidates: [
					{
						index: 0,
						groundingMetadata: { webSearchQueries: ["q"] },
						content: { parts: [{ text: '{"a":1}' }] },
					},
				],
			});
		}
		const events = await collectAsync(
			assembleFromPayloads(payloads(), geminiAdapter({ jsonMode: true })),
		);
		const groundingIndex = events.findIndex((event) => event.type === "grounding");
		const jsonIndex = events.findIndex((event) => event.type === "json.delta");
		expect(groundingIndex).toBeGreaterThanOrEqual(0);
		expect(jsonIndex).toBeGreaterThan(groundingIndex);
	});

	it("LSA-X81: mock adapter citation RawChunk passthrough", async () => {
		const { sequenceMockAdapter } = await import("./helpers/mock-adapter");
		const adapter = sequenceMockAdapter([
			[{ kind: "citation", urls: ["https://mock.test"] }],
			[{ kind: "text-delta", text: "x", choiceIndex: 0 }],
			[{ kind: "finish", reason: "stop" }],
		]);
		const events = await collectAsync(
			assembleFromPayloads(
				(async function* () {
					yield "{}";
					yield "{}";
					yield "{}";
				})(),
				adapter,
			),
		);
		expect(events).toContainEqual({ type: "citation", urls: ["https://mock.test"] });
	});

	it("LSA-X82: Cohere post-finish citation-start dropped as typed citation event", async () => {
		async function* payloads() {
			yield payload({
				type: "message-end",
				delta: { finish_reason: "COMPLETE" },
			});
			yield payload({
				type: "citation-start",
				index: 0,
				delta: { message: { citations: { start: 0, end: 1, text: "x" } } },
			});
		}
		const events = await collectAsync(assembleFromPayloads(payloads(), cohereAdapter()));
		expect(events.some((event) => event.type === "citation")).toBe(false);
	});

	it("LSA-X83: Gemini post-finish citationMetadata dropped", async () => {
		async function* payloads() {
			yield payload({
				candidates: [{ index: 0, finishReason: "STOP", content: { parts: [] } }],
			});
			yield payload({
				candidates: [
					{
						index: 0,
						citationMetadata: { citations: [{ uri: "urn:late-x83" }] },
						content: { parts: [] },
					},
				],
			});
		}
		const events = await collectAsync(assembleFromPayloads(payloads(), geminiAdapter()));
		expect(events.some((event) => event.type === "citation")).toBe(false);
	});

	it("LSA-X84: tapEvents preserves citation event ordering with text deltas", async () => {
		const citation = { type: "citation" as const, urls: ["https://x84.test"] };
		async function* source() {
			yield { type: "text.delta" as const, text: "a" };
			yield citation;
		}
		const events = await collectAsync(tapEvents(source(), () => undefined));
		expect(events.map((event) => event.type)).toEqual(["text.delta", "citation"]);
	});

	it("LSA-X85: jsonMode Gemini grounding before json.delta interleave", async () => {
		async function* payloads() {
			yield payload({
				candidates: [
					{
						index: 0,
						groundingMetadata: { webSearchQueries: ["json-q"] },
						content: { parts: [{ text: '{"k":1}' }] },
					},
				],
			});
		}
		const events = await collectAsync(
			assembleFromPayloads(payloads(), geminiAdapter({ jsonMode: true })),
		);
		const groundingIndex = events.findIndex((event) => event.type === "grounding");
		const jsonIndex = events.findIndex((event) => event.type === "json.delta");
		expect(groundingIndex).toBeGreaterThanOrEqual(0);
		expect(jsonIndex).toBeGreaterThan(groundingIndex);
	});

	it("LSA-X86: OpenAI Chat post-finish logprob dropped", async () => {
		async function* payloads() {
			yield payload({
				choices: [{ delta: { content: "done" }, finish_reason: "stop" }],
			});
			yield payload({
				choices: [
					{
						delta: {},
						logprobs: { content: [{ token: "late", logprob: -0.1 }] },
					},
				],
			});
		}
		const events = await collectAsync(assembleFromPayloads(payloads(), openaiChatAdapter()));
		expect(events.some((event) => event.type === "logprob")).toBe(false);
	});

	it("LSA-X87: compatible generic post-finish logprob dropped", async () => {
		const { openaiCompatibleAdapter } = await import("../src/adapters/openai-compatible");
		async function* payloads() {
			yield payload({
				choices: [{ delta: { content: "done" }, finish_reason: "stop" }],
			});
			yield payload({
				choices: [
					{
						delta: {},
						logprobs: { content: [{ token: "late", logprob: -0.1 }] },
					},
				],
			});
		}
		const events = await collectAsync(assembleFromPayloads(payloads(), openaiCompatibleAdapter()));
		expect(events.some((event) => event.type === "logprob")).toBe(false);
	});

	it("LSA-X88: strictToolArgs with logprob events still validates tool JSON", async () => {
		const { assembleFromFile } = await import("../src/core/assemble-from-file");
		const events = await collectAsync(
			assembleFromFile("test/fixtures/openai-chat/logprobs-tool-stream.sse", openaiChatAdapter(), {
				strictToolArgs: true,
			}),
		);
		expect(events.some((event) => event.type === "logprob")).toBe(true);
		expect(events.some((event) => event.type === "tool_call.done")).toBe(true);
	});

	it("LSA-X89: jsonMode logprob interleave via logprobs-json-mode fixture", async () => {
		const { assembleFromFile } = await import("../src/core/assemble-from-file");
		const events = await collectAsync(
			assembleFromFile(
				"test/fixtures/openai-chat/logprobs-json-mode.sse",
				openaiChatAdapter({ jsonMode: true }),
			),
		);
		const logprobIndex = events.findIndex((event) => event.type === "logprob");
		const jsonIndex = events.findIndex((event) => event.type === "json.delta");
		expect(logprobIndex).toBeGreaterThanOrEqual(0);
		expect(jsonIndex).toBeGreaterThan(logprobIndex);
	});

	it("LSA-X90: mock adapter logprob RawChunk passthrough", async () => {
		const { sequenceMockAdapter } = await import("./helpers/mock-adapter");
		const adapter = sequenceMockAdapter([
			[{ kind: "logprob", channel: "content", token: "m", logprob: -0.1 }],
			[{ kind: "text-delta", text: "m", choiceIndex: 0 }],
			[{ kind: "finish", reason: "stop" }],
		]);
		const events = await collectAsync(
			assembleFromPayloads(
				(async function* () {
					yield "{}";
					yield "{}";
					yield "{}";
				})(),
				adapter,
			),
		);
		expect(events).toContainEqual({
			type: "logprob",
			channel: "content",
			token: "m",
			logprob: -0.1,
		});
	});

	it("LSA-X91: tapEvents preserves logprob before text.delta ordering", async () => {
		async function* source() {
			yield {
				type: "logprob" as const,
				channel: "content" as const,
				token: "a",
				logprob: -0.1,
			};
			yield { type: "text.delta" as const, text: "a" };
		}
		const events = await collectAsync(tapEvents(source(), () => undefined));
		expect(events.map((event) => event.type)).toEqual(["logprob", "text.delta"]);
	});

	it("LSA-X92: multichoice mock logprob choiceIndex passthrough", async () => {
		const { sequenceMockAdapter } = await import("./helpers/mock-adapter");
		const adapter = sequenceMockAdapter([
			[
				{
					kind: "logprob",
					channel: "content",
					token: "b",
					logprob: -0.2,
					choiceIndex: 1,
				},
			],
			[{ kind: "finish", reason: "stop" }],
		]);
		const events = await collectAsync(
			assembleFromPayloads(
				(async function* () {
					yield "{}";
					yield "{}";
				})(),
				adapter,
			),
		);
		expect(events).toContainEqual({
			type: "logprob",
			channel: "content",
			token: "b",
			logprob: -0.2,
			choiceIndex: 1,
		});
	});

	it("LSA-X93: openrouter preset logprob before text on same chunk", () => {
		const chunks = openaiCompatibleAdapter({ provider: "openrouter" }).parseChunk(
			JSON.stringify({
				choices: [
					{
						delta: { content: "r" },
						logprobs: { content: [{ token: "r", logprob: -0.1 }] },
					},
				],
			}),
		);
		expect(chunks.map((chunk) => chunk.kind)).toEqual(["logprob", "text-delta"]);
	});

	it("LSA-X94: lmstudio preset logprobs null with content delta emits no logprob", () => {
		const chunks = openaiCompatibleAdapter({ provider: "lmstudio" }).parseChunk(
			JSON.stringify({
				choices: [{ delta: { content: "m" }, logprobs: null }],
			}),
		);
		expect(chunks.some((chunk) => chunk.kind === "logprob")).toBe(false);
		expect(chunks.some((chunk) => chunk.kind === "text-delta")).toBe(true);
	});

	it("LSA-X95: deepseek reasoning_content and logprobs same chunk ordering", () => {
		const chunks = openaiCompatibleAdapter({ provider: "deepseek" }).parseChunk(
			JSON.stringify({
				choices: [
					{
						delta: { reasoning_content: "think", content: "out" },
						logprobs: { content: [{ token: "out", logprob: -0.1 }] },
					},
				],
			}),
		);
		expect(chunks.map((chunk) => chunk.kind)).toEqual(["logprob", "text-delta", "reasoning-delta"]);
	});

	it("LSA-X96: mock adapter post-finish logprob dropped in assembleFromPayloads", async () => {
		const { sequenceMockAdapter } = await import("./helpers/mock-adapter");
		const adapter = sequenceMockAdapter([
			[{ kind: "finish", reason: "stop" }],
			[{ kind: "logprob", channel: "content", token: "late", logprob: -0.1 }],
		]);
		const events = await collectAsync(
			assembleFromPayloads(
				(async function* () {
					yield "{}";
					yield "{}";
				})(),
				adapter,
			),
		);
		expect(events.some((event) => event.type === "logprob")).toBe(false);
	});

	it("LSA-X97: collectStream accumulates logprobs across mock adapter sequence", async () => {
		const { sequenceMockAdapter } = await import("./helpers/mock-adapter");
		const adapter = sequenceMockAdapter([
			[{ kind: "logprob", channel: "content", token: "a", logprob: -0.1 }],
			[{ kind: "text-delta", text: "a" }],
			[{ kind: "logprob", channel: "content", token: "b", logprob: -0.2 }],
			[{ kind: "text-delta", text: "b" }],
			[{ kind: "finish", reason: "stop" }],
		]);
		async function* stream() {
			for await (const event of assembleFromPayloads(
				(async function* () {
					for (let index = 0; index < 5; index += 1) yield "{}";
				})(),
				adapter,
			)) {
				yield event;
			}
		}
		const collected = await collectStream(stream());
		expect(collected.logprobs.map((event) => event.token)).toEqual(["a", "b"]);
		expect(collected.text).toBe("ab");
	});

	it("LSA-X98: groq preset multichoice logprob choiceIndex passthrough smoke", () => {
		const chunks = openaiCompatibleAdapter({ provider: "groq" }).parseChunk(
			JSON.stringify({
				choices: [
					{
						index: 1,
						delta: { content: "g" },
						logprobs: { content: [{ token: "g", logprob: -0.1 }] },
					},
				],
			}),
		);
		expect(chunks).toContainEqual(
			expect.objectContaining({ kind: "logprob", token: "g", choiceIndex: 1 }),
		);
	});

	it("LSA-X99: mock Responses-shaped logprob RawChunk passthrough", async () => {
		const adapter = {
			parseChunk: () => [
				{
					kind: "logprob" as const,
					channel: "content" as const,
					token: "x",
					logprob: -0.1,
					raw: { source: "responses-mock" },
				},
				{ kind: "text-delta" as const, text: "x" },
			],
		};
		const events = await collectAsync(
			assembleFromPayloads(
				(async function* () {
					yield JSON.stringify({ type: "mock" });
				})(),
				adapter,
			),
		);
		expect(events.some((event) => event.type === "logprob")).toBe(true);
	});

	it("LSA-X100: Chat logprobs-stream golden unchanged (OC320 smoke)", async () => {
		const events = normalizeEvents(
			await runAdapterGoldenStream({
				adapter: openaiChatAdapter(),
				fixtureSsePath: join(openaiFixtures, "logprobs-stream.sse"),
				expectedEventsPath: join(openaiFixtures, "logprobs-stream.expected.json"),
			}),
		);
		expect(events).toEqual(expectedOpenAIEvents("logprobs-stream"));
	});

	it("LSA-X101: collectStream on Responses logprobs mock sequence", async () => {
		async function* source() {
			yield { type: "logprob" as const, channel: "content" as const, token: "a", logprob: -0.1 };
			yield { type: "text.delta" as const, text: "a" };
		}
		const collected = await collectStream(source());
		expect(collected.logprobs).toHaveLength(1);
		expect(collected.text).toBe("a");
	});

	it("LSA-X102: post-finish Responses logprob dropped via assembleFromPayloads", async () => {
		const events = await collectAsync(
			assembleFromPayloads(
				strings(
					JSON.stringify({ type: "response.completed", response: { status: "completed" } }),
					JSON.stringify({
						type: "response.output_text.delta",
						delta: "late",
						logprobs: [{ token: "late", logprob: -0.1 }],
					}),
				),
				openaiResponsesAdapter(),
			),
		);
		expect(events.some((event) => event.type === "logprob")).toBe(false);
	});

	it("LSA-X103: tapEvents preserves logprob-before-text.delta ordering", async () => {
		const events = normalizeResponsesEvents(
			await collectAsync(
				tapEvents(
					assembleStream(
						byteStreamFromStrings(responsesTextFixture("logprobs-stream", "sse")),
						openaiResponsesAdapter(),
					),
					() => undefined,
				),
			),
		);
		const logprobIndex = events.findIndex((event) => event.type === "logprob");
		const textIndex = events.findIndex((event) => event.type === "text.delta");
		expect(logprobIndex).toBeLessThan(textIndex);
	});

	it("LSA-X104: strictToolArgs with Responses logprobs-tool-stream validates tools", async () => {
		const events = await collectAsync(
			assembleFromFile(
				join(responsesFixtures, "logprobs-tool-stream.sse"),
				openaiResponsesAdapter(),
				{
					strictToolArgs: true,
				},
			),
		);
		expect(events.some((event) => event.type === "logprob")).toBe(true);
		expect(events.some((event) => event.type === "tool_call.done")).toBe(true);
	});

	it("LSA-X105: Chat and Responses share isLogprob guard", async () => {
		const events = await collectAsync(
			assembleStream(
				byteStreamFromStrings(responsesTextFixture("logprobs-stream", "sse")),
				openaiResponsesAdapter(),
			),
		);
		expect(events.filter(isLogprob).length).toBe(2);
	});
});
