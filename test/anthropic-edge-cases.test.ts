import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { anthropicAdapter } from "../src/adapters/anthropic";
import { assembleFromPayloads } from "../src/core/assemble-payloads";
import { collectAsync, strings } from "./helpers/collect-events";
import { normalizeAnthropicEvents } from "./helpers/anthropic-fixtures";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const payload = (value: unknown) => JSON.stringify(value);

describe("anthropicAdapter edge cases and docs", () => {
	it("LSA-A21: message_stop without message_delta emits stop finish", () => {
		expect(anthropicAdapter().parseChunk(payload({ type: "message_stop" }))).toEqual([
			{ kind: "finish", reason: "stop" },
		]);
	});

	it("LSA-A22: redacted_thinking block is ignored", () => {
		expect(
			anthropicAdapter().parseChunk(
				payload({
					type: "content_block_start",
					index: 0,
					content_block: { type: "redacted_thinking", data: "redacted" },
				}),
			),
		).toEqual([]);
	});

	it("LSA-A23: jsonMode maps text block deltas to json events", async () => {
		const events = normalizeAnthropicEvents(
			await collectAsync(
				assembleFromPayloads(
					strings(
						payload({ type: "content_block_start", index: 0, content_block: { type: "text" } }),
						payload({
							type: "content_block_delta",
							index: 0,
							delta: { type: "text_delta", text: '{"ok":true}' },
						}),
						payload({ type: "message_delta", delta: { stop_reason: "end_turn" } }),
					),
					anthropicAdapter({ jsonMode: true }),
				),
			),
		);
		expect(events).toEqual([
			{ type: "json.delta", delta: '{"ok":true}', partial: { ok: true } },
			{ type: "json.done", value: { ok: true } },
			{ type: "finish", reason: "stop" },
		]);
	});

	it("LSA-A24: unknown content block types are ignored without throwing", () => {
		expect(
			anthropicAdapter().parseChunk(
				payload({ type: "content_block_start", index: 0, content_block: { type: "image" } }),
			),
		).toEqual([]);
	});

	it("LSA-A25: fixture provenance README exists and references Anthropic fixtures", () => {
		const readme = readFileSync(join(rootDir, "test/fixtures/anthropic/README.md"), "utf8");
		for (const name of ["text-basic", "tool-use", "thinking", "refusal", "provider-error"]) {
			expect(readme).toContain(name);
		}
	});
});
