import { describe, expect, it } from "vitest";
import { anthropicAdapter } from "../src/adapters/anthropic";
import { bedrockAdapter } from "../src/adapters/bedrock";
import { cohereAdapter } from "../src/adapters/cohere";
import { geminiAdapter } from "../src/adapters/gemini";
import { openaiChatAdapter } from "../src/adapters/openai-chat";
import { openaiResponsesAdapter } from "../src/adapters/openai-responses";
import type { StreamAdapter } from "../src/core/types";
import {
	parseChunkAdapters,
	parseChunkPayloads,
	requiredParseChunkCategories,
	type ParseChunkAdapterName,
	type ParseChunkPayloadCase,
} from "./helpers/parse-chunk-payloads";
import { normalizeRawChunks } from "./helpers/parse-chunk-snapshots";

const adapterFactories: Record<ParseChunkAdapterName, () => StreamAdapter> = {
	"openai-chat": () => openaiChatAdapter(),
	"openai-responses": () => openaiResponsesAdapter(),
	anthropic: () => anthropicAdapter(),
	gemini: () => geminiAdapter(),
	"gemini-vertex": () => geminiAdapter({ apiSurface: "vertex" }),
	bedrock: () => bedrockAdapter(),
	cohere: () => cohereAdapter(),
};

interface MatrixRow {
	adapter: ParseChunkAdapterName;
	row: ParseChunkPayloadCase;
	label: string;
}

const matrixRows: MatrixRow[] = parseChunkAdapters.flatMap((adapter) =>
	parseChunkPayloads[adapter].map((row) => ({
		adapter,
		row,
		label: `${adapter} ${row.id} ${row.category} ${row.note}`,
	})),
);

describe("parseChunk atom matrix", () => {
	it("PC01: every adapter has at least 40 payload rows", () => {
		for (const adapter of parseChunkAdapters) {
			expect(parseChunkPayloads[adapter].length).toBeGreaterThanOrEqual(40);
		}
	});

	it("PC02: every adapter covers required parseChunk categories", () => {
		for (const adapter of parseChunkAdapters) {
			const categories = new Set(parseChunkPayloads[adapter].map((row) => row.category));
			for (const required of requiredParseChunkCategories) {
				expect(categories.has(required), `${adapter} missing category: ${required}`).toBe(true);
			}
		}
	});

	it("PC03: adapter row IDs are unique", () => {
		for (const adapter of parseChunkAdapters) {
			const ids = parseChunkPayloads[adapter].map((row) => row.id);
			expect(new Set(ids).size).toBe(ids.length);
		}
	});

	it("PC04: shared gate IDs PC01-PC05 exist per adapter", () => {
		const gateIds = new Set(["PC01", "PC02", "PC03", "PC04", "PC05"]);
		for (const adapter of parseChunkAdapters) {
			const ids = new Set(parseChunkPayloads[adapter].map((row) => row.id));
			for (const gateId of gateIds) {
				expect(ids.has(gateId), `${adapter} missing gate ${gateId}`).toBe(true);
			}
		}
	});

	it("PC05: adapter payload catalog and factories stay in lockstep", () => {
		expect(Object.keys(adapterFactories).sort()).toEqual([...parseChunkAdapters].sort());
	});

	it("MAINT45: parseChunk atom matrix row count stays above floor", () => {
		expect(matrixRows.length).toBeGreaterThanOrEqual(280);
	});

	it.each(matrixRows)("$label", ({ adapter, row }) => {
		const instance = adapterFactories[adapter]();
		for (const prelude of row.prelude ?? []) {
			instance.parseChunk(prelude);
		}
		const chunks = instance.parseChunk(row.payload);
		expect(normalizeRawChunks(chunks)).toMatchSnapshot();
	});
});
