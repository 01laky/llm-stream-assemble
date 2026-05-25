import { describe, expect, it } from "vitest";
import { assembleResponse } from "../src/core/assemble-response";
import { mockAdapterFromFixture } from "./helpers/mock-adapter";

describe("assembleResponse", () => {
	it("LSA-C44: assembles mock parseResponse output", () => {
		expect(assembleResponse({}, mockAdapterFromFixture("text-basic"))).toEqual([
			{ type: "text.delta", text: "Hello" },
			{ type: "text.delta", text: " world" },
			{ type: "text.done", text: "Hello world" },
			{ type: "finish", reason: "stop" },
		]);
	});

	it("LSA-C45: throws when adapter has no parseResponse", () => {
		expect(() => assembleResponse({}, { parseChunk: () => [] })).toThrow(
			/^llm-stream-assemble: adapter\.parseResponse is required/,
		);
	});
});
