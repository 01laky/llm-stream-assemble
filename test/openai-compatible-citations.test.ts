import { describe, expect, it } from "vitest";
import { openaiCompatibleAdapter } from "../src/adapters/openai-compatible";
import { assembleFromPayloads } from "../src/core/assemble-payloads";
import { assembleResponse } from "../src/core/assemble-response";
import { assembleStream } from "../src/core/assemble-stream";
import { collectStream } from "../src/transforms/collect-stream";
import { byteStreamFromStrings, collectAsync } from "./helpers/collect-events";
import {
	expectedHostCompatibleEvents,
	hostCompatibleFixture,
	normalizeCompatibleEvents,
} from "./helpers/compatible-fixtures";

describe("openaiCompatibleAdapter citation and grounding", () => {
	const perplexity = () => openaiCompatibleAdapter({ provider: "perplexity" });
	const payload = (value: unknown) => JSON.stringify(value);

	it("LSA-OC276: perplexity parseChunk emits citation RawChunk with urls", () => {
		const chunks = perplexity().parseChunk(
			payload({ citations: ["https://example.com/doc"], choices: [{ delta: {} }] }),
		);
		expect(chunks).toContainEqual({
			kind: "citation",
			urls: ["https://example.com/doc"],
			raw: { citations: ["https://example.com/doc"] },
		});
	});

	it("LSA-OC277: perplexity citations-stream golden includes citation event", async () => {
		const events = normalizeCompatibleEvents(
			await collectAsync(
				assembleStream(
					byteStreamFromStrings(
						hostCompatibleFixture("perplexity", "citations-stream", "sse") as string,
					),
					perplexity(),
				),
			),
		);
		expect(events).toEqual(expectedHostCompatibleEvents("perplexity", "citations-stream"));
		expect(events.some((event) => (event as { type?: string }).type === "citation")).toBe(true);
	});

	it("LSA-OC278: search_results mapped to searchResults", () => {
		const chunks = perplexity().parseChunk(
			payload({
				search_results: [{ url: "https://search.test", title: "Doc" }],
				choices: [{ delta: {} }],
			}),
		);
		expect(chunks).toContainEqual(
			expect.objectContaining({
				kind: "citation",
				searchResults: [{ url: "https://search.test", title: "Doc" }],
			}),
		);
	});

	it("LSA-OC279: response-citations non-stream golden", () => {
		expect(
			normalizeCompatibleEvents(
				assembleResponse(
					hostCompatibleFixture("perplexity", "response-citations", "json"),
					perplexity(),
				),
			),
		).toEqual(expectedHostCompatibleEvents("perplexity", "response-citations"));
	});

	it("LSA-OC280: generic preset tolerates root citations without throw", () => {
		expect(
			openaiCompatibleAdapter({ provider: "generic" }).parseChunk(
				payload({ citations: ["https://generic.test"], choices: [{ delta: { content: "x" } }] }),
			),
		).toContainEqual(expect.objectContaining({ kind: "citation", urls: ["https://generic.test"] }));
	});

	it("LSA-OC281: azure preset ignores citations fields if present", () => {
		const chunks = openaiCompatibleAdapter({ provider: "azure" }).parseChunk(
			payload({ citations: ["https://azure.test"], choices: [{ delta: { content: "x" } }] }),
		);
		expect(chunks.some((chunk) => chunk.kind === "citation")).toBe(true);
		expect(chunks.some((chunk) => chunk.kind === "text-delta")).toBe(true);
	});

	it("LSA-OC282: citation and text on same chunk ordering", () => {
		const chunks = perplexity().parseChunk(
			payload({
				citations: ["https://order.test"],
				choices: [{ delta: { content: "answer" } }],
			}),
		);
		expect(chunks.map((chunk) => chunk.kind)).toEqual(["citation", "text-delta"]);
	});

	it("LSA-OC283: empty citations array yields no citation event", () => {
		const chunks = perplexity().parseChunk(payload({ citations: [], choices: [{ delta: {} }] }));
		expect(chunks.some((chunk) => chunk.kind === "citation")).toBe(false);
	});

	it("LSA-OC285: collectStream on perplexity fixture populates citations array", async () => {
		const events = await collectAsync(
			assembleStream(
				byteStreamFromStrings(
					hostCompatibleFixture("perplexity", "citations-stream", "sse") as string,
				),
				perplexity(),
			),
		);
		const collected = await collectStream(
			(async function* () {
				for (const event of events) yield event;
			})(),
		);
		expect(collected.citations.length).toBeGreaterThan(0);
	});

	it("LSA-OC286: post-finish citation dropped on compatible assembly", async () => {
		async function* payloads() {
			yield payload({
				choices: [{ delta: { content: "done" }, finish_reason: "stop" }],
			});
			yield payload({ citations: ["https://late.test"] });
		}
		const events = await collectAsync(assembleFromPayloads(payloads(), perplexity()));
		expect(events.some((event) => event.type === "citation")).toBe(false);
	});

	it("LSA-OC287: multiple chunks with citations append multiple events", async () => {
		async function* payloads() {
			yield payload({ citations: ["https://one.test"], choices: [{ delta: {} }] });
			yield payload({ citations: ["https://two.test"], choices: [{ delta: {} }] });
		}
		const events = await collectAsync(assembleFromPayloads(payloads(), perplexity()));
		expect(events.filter((event) => event.type === "citation")).toHaveLength(2);
	});

	it("LSA-OC288: parseResponse on perplexity response-citations emits citation RawChunk", () => {
		const chunks = perplexity().parseResponse!(
			hostCompatibleFixture("perplexity", "response-citations", "json"),
		);
		expect(chunks.some((chunk) => chunk.kind === "citation")).toBe(true);
	});

	it("LSA-OC289: assembleResponse on same fixture yields typed citation StreamEvent", () => {
		const events = assembleResponse(
			hostCompatibleFixture("perplexity", "response-citations", "json"),
			perplexity(),
		);
		expect(events.some((event) => event.type === "citation")).toBe(true);
	});

	it("LSA-OC290: search_results only without citations array emits citation event", () => {
		const chunks = openaiCompatibleAdapter({ provider: "perplexity" }).parseChunk(
			payload({
				search_results: [{ url: "https://search-only.test", snippet: "snippet" }],
				choices: [{ delta: { content: "x" } }],
			}),
		);
		expect(chunks).toContainEqual(
			expect.objectContaining({
				kind: "citation",
				searchResults: [{ url: "https://search-only.test", snippet: "snippet" }],
			}),
		);
	});

	it("LSA-OC291: citations array with non-string entries filters urls but keeps raw", () => {
		const chunks = openaiCompatibleAdapter({ provider: "perplexity" }).parseChunk(
			payload({
				citations: ["https://ok.test", { bad: true }],
				choices: [{ delta: {} }],
			}),
		);
		const citation = chunks.find((chunk) => chunk.kind === "citation") as {
			urls?: string[];
		};
		expect(citation?.urls).toEqual(["https://ok.test"]);
	});

	it("LSA-OC292: emitLegacyCitationMetadata on generic preset dual-emits metadata", () => {
		const chunks = openaiCompatibleAdapter({
			provider: "generic",
			emitLegacyCitationMetadata: true,
		}).parseChunk(
			payload({
				citations: ["https://legacy-generic.test"],
				choices: [{ delta: { content: "x" } }],
			}),
		);
		expect(chunks.some((chunk) => chunk.kind === "citation")).toBe(true);
		expect(chunks.some((chunk) => chunk.kind === "metadata")).toBe(true);
	});

	it("LSA-OC293: deepseek preset tolerates root citations without throw", () => {
		expect(
			openaiCompatibleAdapter({ provider: "deepseek" }).parseChunk(
				payload({
					citations: ["https://deepseek.test"],
					choices: [{ delta: { content: "x" } }],
				}),
			),
		).toContainEqual(
			expect.objectContaining({ kind: "citation", urls: ["https://deepseek.test"] }),
		);
	});

	it("LSA-OC294: mistral preset citation before reasoning_content on same chunk", () => {
		const chunks = openaiCompatibleAdapter({ provider: "mistral" }).parseChunk(
			payload({
				citations: ["https://mistral.test"],
				choices: [{ delta: { content: "visible", reasoning_content: "hidden" } }],
			}),
		);
		expect(chunks.map((chunk) => chunk.kind)).toEqual([
			"citation",
			"text-delta",
			"reasoning-delta",
		]);
	});

	it("LSA-OC295: assembleResponse perplexity response-citations has no metadata.raw citations", () => {
		const events = assembleResponse(
			hostCompatibleFixture("perplexity", "response-citations", "json"),
			openaiCompatibleAdapter({ provider: "perplexity" }),
		);
		expect(events.some((event) => event.type === "citation")).toBe(true);
		expect(
			events.some(
				(event) =>
					event.type === "metadata" &&
					typeof event.raw === "object" &&
					event.raw !== null &&
					"citations" in (event.raw as Record<string, unknown>),
			),
		).toBe(false);
	});
});
