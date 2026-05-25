import { describe, expect, it } from "vitest";
import { openaiCompatibleAdapter } from "../src/adapters/openai-compatible";
import { normalizeCompatibleRawChunks } from "./helpers/compatible-fixtures";

const payload = (value: unknown) => JSON.stringify(value);

describe("openaiCompatibleAdapter error shapes", () => {
	it("LSA-OC15: standard error object maps provider error and finish error", () => {
		expect(
			normalizeCompatibleRawChunks(
				openaiCompatibleAdapter().parseChunk(payload({ error: { message: "standard" } })),
			),
		).toEqual([
			{ kind: "provider-error", recoverable: false },
			{ kind: "finish", reason: "error" },
		]);
	});

	it("LSA-OC16: string error maps provider error when loose", () => {
		expect(
			normalizeCompatibleRawChunks(
				openaiCompatibleAdapter().parseChunk(payload({ error: "boom" })),
			),
		).toEqual([
			{ kind: "provider-error", recoverable: false },
			{ kind: "finish", reason: "error" },
		]);
	});

	it("LSA-OC17: detail string maps provider error when loose", () => {
		expect(
			normalizeCompatibleRawChunks(
				openaiCompatibleAdapter().parseChunk(payload({ detail: "boom" })),
			),
		).toEqual([
			{ kind: "provider-error", recoverable: false },
			{ kind: "finish", reason: "error" },
		]);
	});

	it("LSA-OC18: detail object maps provider error when loose", () => {
		expect(
			normalizeCompatibleRawChunks(
				openaiCompatibleAdapter().parseChunk(payload({ detail: { message: "boom" } })),
			),
		).toEqual([
			{ kind: "provider-error", recoverable: false },
			{ kind: "finish", reason: "error" },
		]);
	});

	it("LSA-OC19: loose error disabled does not treat nonstandard shapes as provider errors", () => {
		expect(
			openaiCompatibleAdapter({ looseErrorShape: false }).parseChunk(payload({ detail: "boom" })),
		).toEqual([]);
	});

	it("LSA-OC19b: compatible errors do not mention openaiChatAdapter", () => {
		expect(() => openaiCompatibleAdapter().parseChunk("{")).toThrow(/openaiCompatibleAdapter/);
		expect(() => openaiCompatibleAdapter().parseChunk("{")).not.toThrow(/openaiChatAdapter/);
	});
});
