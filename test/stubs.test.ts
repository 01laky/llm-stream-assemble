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
import { NOT_IMPLEMENTED_PATTERN } from "./fixtures/sample-events";
import { collectAsync, strings } from "./helpers/collect-events";
import { mockAdapterFromFixture } from "./helpers/mock-adapter";

async function* emptyStrings(): AsyncIterable<string> {
	// no yields
}

async function expectAsyncNotImplemented(iterable: AsyncIterable<unknown>) {
	await expectForAwaitNotImplemented(iterable);
}

async function expectForAwaitNotImplemented(iterable: AsyncIterable<unknown>) {
	await expect(async () => {
		for await (const _item of iterable) {
			void _item;
		}
	}).rejects.toThrow(NOT_IMPLEMENTED_PATTERN);
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

		it("LSA-ST03: assembleFromFile throws on iteration", async () => {
			await expectForAwaitNotImplemented(assembleFromFile("/tmp/fixture.sse", openaiChatAdapter()));
		});

		it("LSA-ST04: parseSSE yields payloads", async () => {
			await expect(collectAsync(parseSSE(strings("data: ok\n\n")))).resolves.toEqual(["ok"]);
		});

		it("LSA-ST05: tapEvents throws on iteration", async () => {
			await expectAsyncNotImplemented(
				tapEvents(assembleStream(emptyStrings(), openaiChatAdapter()), () => undefined),
			);
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

	describe("transform stubs", () => {
		it("LSA-ST09: collectStream rejects", async () => {
			await expect(
				collectStream(assembleStream(emptyStrings(), openaiChatAdapter())),
			).rejects.toThrow(NOT_IMPLEMENTED_PATTERN);
		});

		it("LSA-ST10: toSSE throws immediately", () => {
			expect(() =>
				toSSE(assembleStream(emptyStrings(), openaiChatAdapter()), { sanitizeErrors: true }),
			).toThrow(NOT_IMPLEMENTED_PATTERN);
		});
	});

	describe("adapter parseChunk stubs", () => {
		it("LSA-ST11: openaiChatAdapter.parseChunk throws", () => {
			expect(() => openaiChatAdapter().parseChunk("{}")).toThrow(/openaiChatAdapter\.parseChunk/i);
		});

		it("LSA-ST12: openaiCompatibleAdapter.parseChunk throws", () => {
			expect(() => openaiCompatibleAdapter().parseChunk("{}")).toThrow(
				/openaiCompatibleAdapter\.parseChunk/i,
			);
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
		expect(() => openaiChatAdapter().parseChunk("{}")).toThrow(/^llm-stream-assemble:/);
	});
});
