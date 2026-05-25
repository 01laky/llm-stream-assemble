import { describe, expect, it } from "vitest";
import {
	anthropicAdapter,
	assembleFromFile,
	assembleFromPayloads,
	assembleResponse,
	assembleStream,
	collectStream,
	createAssemblyTransform,
	openaiChatAdapter,
	openaiCompatibleAdapter,
	openaiResponsesAdapter,
	parsePartialJSON,
	parseSSE,
	tapEvents,
	toSSE,
} from "../src/index";
import { collectAsync, strings } from "./helpers/collect-events";
import { mockAdapterFromFixture } from "./helpers/mock-adapter";

async function* emptyStrings(): AsyncIterable<string> {
	// no yields
}

describe("stubs.test.ts", () => {
	describe("core streaming stubs", () => {
		it("LSA-ST01: assembleStream yields events", async () => {
			await expect(
				collectAsync(
					assembleStream(
						strings('data: {"seq":1}\n\ndata: [DONE]\n\n'),
						mockAdapterFromFixture("text-basic"),
					),
				),
			).resolves.toEqual([
				{ type: "text.delta", text: "Hello" },
				{ type: "text.done", text: "Hello" },
				{ type: "finish", reason: "stop" },
			]);
		});

		it("LSA-ST02: assembleFromPayloads yields events", async () => {
			await expect(
				collectAsync(
					assembleFromPayloads(
						strings('{"seq":1}', "[DONE]"),
						mockAdapterFromFixture("text-basic"),
					),
				),
			).resolves.toEqual([
				{ type: "text.delta", text: "Hello" },
				{ type: "text.done", text: "Hello" },
				{ type: "finish", reason: "stop" },
			]);
		});

		it("LSA-ST03: assembleFromFile is implemented and reports missing files", async () => {
			await expect(
				collectAsync(assembleFromFile("/tmp/fixture.sse", openaiChatAdapter())),
			).rejects.toThrow(/^llm-stream-assemble: assembleFromFile/);
		});

		it("LSA-ST04: parseSSE yields payloads", async () => {
			await expect(collectAsync(parseSSE(strings("data: ok\n\n")))).resolves.toEqual(["ok"]);
		});

		it("LSA-ST05: tapEvents yields source events", async () => {
			await expect(
				collectAsync(tapEvents(emptyStrings() as AsyncIterable<never>, () => undefined)),
			).resolves.toEqual([]);
		});
	});

	describe("core sync stubs", () => {
		it("LSA-ST06: assembleResponse returns events", () => {
			expect(assembleResponse({}, mockAdapterFromFixture("text-basic"))).toEqual([
				{ type: "text.delta", text: "Hello" },
				{ type: "text.delta", text: " world" },
				{ type: "text.done", text: "Hello world" },
				{ type: "finish", reason: "stop" },
			]);
		});

		it("LSA-ST07: parsePartialJSON returns a result object", () => {
			expect(parsePartialJSON('{"a":"b')).toEqual({ complete: false, value: { a: "b" } });
		});

		it("LSA-ST08: createAssemblyTransform returns a TransformStream", () => {
			expect(createAssemblyTransform(mockAdapterFromFixture("text-basic"))).toBeInstanceOf(
				TransformStream,
			);
		});
	});

	describe("transform implementations", () => {
		it("LSA-ST09: collectStream resolves an empty result", async () => {
			await expect(collectStream(emptyStrings() as AsyncIterable<never>)).resolves.toMatchObject({
				text: "",
				reasoning: "",
				refusals: "",
				json: undefined,
				toolCalls: [],
			});
		});

		it("LSA-ST10: toSSE returns a ReadableStream", () => {
			expect(
				toSSE(emptyStrings() as AsyncIterable<never>, { sanitizeErrors: true }),
			).toBeInstanceOf(ReadableStream);
		});
	});

	describe("adapter parseChunk stubs", () => {
		it("LSA-ST11: openaiChatAdapter.parseChunk is implemented", () => {
			expect(openaiChatAdapter().parseChunk("{}")).toEqual([]);
		});

		it("LSA-ST12: openaiCompatibleAdapter.parseChunk is implemented", () => {
			expect(openaiCompatibleAdapter().parseChunk("{}")).toEqual([]);
		});

		it("LSA-ST13: anthropicAdapter.parseChunk throws", () => {
			expect(() => anthropicAdapter().parseChunk("{}")).toThrow(/anthropicAdapter\.parseChunk/i);
		});

		it("LSA-ST14: openaiResponsesAdapter.parseChunk throws", () => {
			expect(() => openaiResponsesAdapter().parseChunk("{}")).toThrow(
				/openaiResponsesAdapter\.parseChunk/i,
			);
		});
	});

	it("LSA-ST15: error messages include llm-stream-assemble prefix", () => {
		expect(() => anthropicAdapter().parseChunk("{}")).toThrow(/^llm-stream-assemble:/);
	});
});
