import { execSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, beforeAll } from "vitest";
import * as lib from "../src/index";
import { anthropicAdapter } from "../src/adapters/anthropic";
import { openaiChatAdapter } from "../src/adapters/openai-chat";
import { openaiCompatibleAdapter } from "../src/adapters/openai-compatible";
import { openaiResponsesAdapter } from "../src/adapters/openai-responses";
import {
	asNumber,
	asString,
	isRecord,
	optionalRawChunk,
	parseAdapterJSON,
	prefixedAdapterError,
} from "../src/adapters/utils";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

beforeAll(() => {
	if (!existsSync(join(rootDir, "dist/index.js"))) {
		execSync("npx pnpm@9 build", { cwd: rootDir, stdio: "pipe" });
	}
});

describe("maintenance adapter utilities", () => {
	it("LSA-MAINT01: isRecord accepts plain objects and rejects null arrays primitives", () => {
		expect(isRecord({})).toBe(true);
		expect(isRecord(null)).toBe(false);
		expect(isRecord([])).toBe(false);
		expect(isRecord("x")).toBe(false);
	});

	it("LSA-MAINT02: asString returns only strings", () => {
		expect(asString("x")).toBe("x");
		expect(asString(1)).toBeUndefined();
	});

	it("LSA-MAINT03: asNumber returns only finite numbers", () => {
		expect(asNumber(1)).toBe(1);
		expect(asNumber(Number.NaN)).toBeUndefined();
		expect(asNumber("1")).toBeUndefined();
	});

	it("LSA-MAINT04: optionalRawChunk removes undefined fields and preserves falsy values", () => {
		expect(
			optionalRawChunk({ kind: "text-delta", text: "", choiceIndex: 0, extra: undefined }),
		).toEqual({
			kind: "text-delta",
			text: "",
			choiceIndex: 0,
		});
	});

	it("LSA-MAINT05: parseAdapterJSON parses objects", () => {
		expect(parseAdapterJSON('{"ok":true}', "test")).toEqual({ ok: true });
	});

	it("LSA-MAINT06: parseAdapterJSON throws prefixed errors on invalid JSON", () => {
		expect(() => parseAdapterJSON("{", "adapter.parseChunk")).toThrow(
			/^llm-stream-assemble: adapter\.parseChunk:/,
		);
	});

	it("LSA-MAINT07: prefixedAdapterError includes prefix", () => {
		expect(prefixedAdapterError("adapter", "failed").message).toBe(
			"llm-stream-assemble: adapter: failed",
		);
	});

	it("LSA-MAINT07b: adapter utils file has internal not public API comment", () => {
		expect(readFileSync(join(rootDir, "src/adapters/utils.ts"), "utf8")).toContain(
			"Not part of the public API",
		);
	});
});

describe("maintenance adapter regressions", () => {
	it("LSA-MAINT08: OpenAI Chat representative payload emits expected raw chunks", () => {
		expect(
			openaiChatAdapter().parseChunk(
				JSON.stringify({ choices: [{ index: 0, delta: { content: "hi" } }] }),
			),
		).toEqual([{ kind: "text-delta", text: "hi", choiceIndex: 0 }]);
	});

	it("LSA-MAINT09: OpenAI-compatible representative payload emits expected raw chunks", () => {
		expect(
			openaiCompatibleAdapter().parseChunk(
				JSON.stringify({ choices: [{ delta: { content: "hi" } }] }),
			),
		).toEqual([{ kind: "text-delta", text: "hi", choiceIndex: 0 }]);
	});

	it("LSA-MAINT10: Anthropic representative payload emits expected raw chunks", () => {
		expect(
			anthropicAdapter().parseChunk(
				JSON.stringify({
					type: "content_block_delta",
					index: 0,
					delta: { type: "text_delta", text: "hi" },
				}),
			),
		).toEqual([{ kind: "text-delta", text: "hi" }]);
	});

	it("LSA-MAINT11: OpenAI Responses representative payload emits expected raw chunks", () => {
		expect(
			openaiResponsesAdapter().parseChunk(
				JSON.stringify({ type: "response.output_text.delta", delta: "hi" }),
			),
		).toEqual([{ kind: "text-delta", text: "hi" }]);
	});

	it("LSA-MAINT11b: adapter malformed JSON error prefixes remain unchanged", () => {
		expect(() => openaiChatAdapter().parseChunk("{")).toThrow(/openaiChatAdapter\.parseChunk/);
		expect(() => anthropicAdapter().parseChunk("{")).toThrow(/anthropicAdapter\.parseChunk/);
		expect(() => openaiResponsesAdapter().parseChunk("{")).toThrow(
			/openaiResponsesAdapter\.parseChunk/,
		);
	});
});

describe("maintenance public API cleanup", () => {
	it("LSA-MAINT12: scaffold notImplemented helpers are removed from source", () => {
		expect(existsSync(join(rootDir, "src/helpers/not-implemented.ts"))).toBe(false);
	});

	it("LSA-MAINT13: README and docs do not mention notImplemented as user API", () => {
		const readme = readFileSync(join(rootDir, "README.md"), "utf8");
		const adapterGuide = readFileSync(join(rootDir, "docs/adapter-guide.md"), "utf8");
		expect(readme).not.toContain("notImplemented");
		expect(adapterGuide).not.toContain("notImplemented");
	});

	it("LSA-MAINT14: existing unimplemented future adapter still throws prefixed errors", () => {
		expect(() => lib.openaiResponsesAdapter().parseChunk("{")).toThrow(/^llm-stream-assemble:/);
	});

	it("LSA-MAINT15: root export no longer exposes scaffold helpers", () => {
		expect("notImplemented" in lib).toBe(false);
		expect("notImplementedAsyncIterable" in lib).toBe(false);
	});
});

describe("maintenance build and bundle regressions", () => {
	it("LSA-MAINT16: build output still contains adapter subpath bundles", () => {
		for (const file of [
			"dist/adapters/openai-chat.js",
			"dist/adapters/openai-compatible.js",
			"dist/adapters/anthropic.js",
			"dist/index.js",
		]) {
			expect(existsSync(join(rootDir, file))).toBe(true);
		}
	});

	it("LSA-MAINT17: bundle size does not grow unexpectedly after helper refactor", () => {
		const limits = new Map([
			["dist/index.js", 200_000],
			["dist/adapters/openai-chat.js", 80_000],
			["dist/adapters/openai-compatible.js", 80_000],
			["dist/adapters/anthropic.js", 80_000],
		]);
		for (const [file, limit] of limits) {
			expect(statSync(join(rootDir, file)).size).toBeLessThan(limit);
		}
	});
});
