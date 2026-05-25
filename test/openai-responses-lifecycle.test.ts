import { describe, expect, it } from "vitest";
import { openaiResponsesAdapter } from "../src/adapters/openai-responses";
import { normalizeResponsesRawChunks } from "./helpers/responses-fixtures";

const payload = (value: unknown) => JSON.stringify(value);

describe("openaiResponsesAdapter lifecycle", () => {
	it("LSA-R21: response.completed emits finish stop", () => {
		expect(
			openaiResponsesAdapter().parseChunk(
				payload({ type: "response.completed", response: { status: "completed" } }),
			),
		).toEqual([{ kind: "finish", reason: "stop" }]);
	});

	it("LSA-R22: response.failed emits provider error and finish error", () => {
		expect(
			normalizeResponsesRawChunks(
				openaiResponsesAdapter().parseChunk(
					payload({ type: "response.failed", response: { error: { message: "failed" } } }),
				),
			),
		).toEqual([
			{ kind: "provider-error", recoverable: false },
			{ kind: "finish", reason: "error" },
		]);
	});

	it("LSA-R23: response.incomplete emits finish incomplete", () => {
		expect(
			openaiResponsesAdapter().parseChunk(
				payload({ type: "response.incomplete", response: { status: "incomplete" } }),
			),
		).toEqual([{ kind: "finish", reason: "incomplete" }]);
	});

	it("LSA-R24: top-level error event emits provider error and finish error", () => {
		expect(
			normalizeResponsesRawChunks(
				openaiResponsesAdapter().parseChunk(payload({ type: "error", message: "top error" })),
			),
		).toEqual([
			{ kind: "provider-error", recoverable: false },
			{ kind: "finish", reason: "error" },
		]);
	});

	it("LSA-R25: unknown events are ignored", () => {
		expect(openaiResponsesAdapter().parseChunk(payload({ type: "response.unknown" }))).toEqual([]);
	});
});
