import { describe, expect, it } from "vitest";
import { openaiResponsesAdapter } from "../src/adapters/openai-responses";
import { assembleStream } from "../src/core/assemble-stream";
import { byteStreamFromSplitString } from "./helpers/byte-stream";
import { collectAsync } from "./helpers/collect-events";
import { responsesTextFixture } from "./helpers/responses-fixtures";

const FIXTURES = [
	{ name: "logprobs-stream", adapterOptions: {} },
	{ name: "logprobs-tool-stream", adapterOptions: {} },
	{ name: "logprobs-json-mode", adapterOptions: { jsonMode: true } },
	{ name: "logprobs-refusal", adapterOptions: {} },
	{ name: "logprobs-done-batch", adapterOptions: {} },
] as const;

const CHUNK_SIZES = [0, 1, 3, 7, 17, 31] as const;

describe("responses logprobs combinatorial matrix", () => {
	const rows = FIXTURES.flatMap((fixture) =>
		CHUNK_SIZES.map((chunkSize) => ({
			fixture,
			chunkSize,
			label: `${fixture.name}@${chunkSize}`,
		})),
	);
	const gatedRows = rows.map((row, index) => ({
		...row,
		gate: index < 19 ? `LSA-RL${92 + index}` : "LSA-RL110+",
	}));

	it("LSA-RL91: responses logprobs combinatorial matrix has >= 30 rows", () => {
		expect(FIXTURES.length).toBeGreaterThanOrEqual(5);
		expect(CHUNK_SIZES).toEqual([0, 1, 3, 7, 17, 31]);
		expect(rows.length).toBeGreaterThanOrEqual(30);
	});

	it.each(gatedRows)("$gate $label assembles logprob events", async ({ fixture, chunkSize }) => {
		const raw = responsesTextFixture(fixture.name, "sse");
		const events = await collectAsync(
			assembleStream(
				byteStreamFromSplitString(raw, chunkSize),
				openaiResponsesAdapter(fixture.adapterOptions),
			),
		);
		expect(events.some((event) => event.type === "finish")).toBe(true);
		expect(events.some((event) => event.type === "logprob")).toBe(true);
		if (fixture.name.includes("json-mode")) {
			expect(events.some((event) => event.type === "json.delta")).toBe(true);
		}
	});
});
