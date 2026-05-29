import { describe, expect, it } from "vitest";
import { assembleFromPayloads } from "../src/core/assemble-payloads";
import type { StreamEvent } from "../src/core/types";
import { collectAsync, strings } from "./helpers/collect-events";
import {
	type AdapterFamily,
	type AdapterOptionsMatrixRow,
	type AdapterOptionsRowSpec,
	buildAdapterOptionsRows,
} from "./helpers/adapter-options-matrix";

const ALL_ADAPTERS: readonly AdapterFamily[] = [
	"openai-chat",
	"openai-compatible",
	"openai-responses",
	"anthropic",
	"gemini",
	"cohere",
	"bedrock",
];

const LEGACY_ADAPTERS: readonly AdapterFamily[] = ["openai-compatible", "gemini", "cohere"];

function buildSpecs(): AdapterOptionsRowSpec[] {
	const specs: AdapterOptionsRowSpec[] = [];
	let index = 1;

	const id = () => `ROW${String(index++).padStart(3, "0")}`;

	for (const adapterFamily of ALL_ADAPTERS) {
		for (const jsonMode of [false, true] as const) {
			for (const strictToolArgs of [false, true] as const) {
				for (const recoverMalformed of [false, true] as const) {
					specs.push({
						id: id(),
						adapterFamily,
						scenario: "json-text",
						jsonMode,
						strictToolArgs,
						recoverMalformed,
						emitLegacyCitationMetadata: false,
					});
				}
			}
		}
	}

	for (const adapterFamily of ALL_ADAPTERS) {
		for (const jsonMode of [false, true] as const) {
			for (const strictToolArgs of [false, true] as const) {
				specs.push({
					id: id(),
					adapterFamily,
					scenario: "strict-tool-invalid",
					jsonMode,
					strictToolArgs,
					recoverMalformed: false,
					emitLegacyCitationMetadata: false,
				});
			}
		}
	}

	for (const adapterFamily of ALL_ADAPTERS) {
		for (const jsonMode of [false, true] as const) {
			for (const recoverMalformed of [false, true] as const) {
				specs.push({
					id: id(),
					adapterFamily,
					scenario: "recover-malformed",
					jsonMode,
					strictToolArgs: false,
					recoverMalformed,
					emitLegacyCitationMetadata: false,
				});
			}
		}
	}

	for (const adapterFamily of LEGACY_ADAPTERS) {
		for (const jsonMode of [false, true] as const) {
			for (const strictToolArgs of [false, true] as const) {
				for (const emitLegacyCitationMetadata of [false, true] as const) {
					specs.push({
						id: id(),
						adapterFamily,
						scenario: "legacy-citation",
						jsonMode,
						strictToolArgs,
						recoverMalformed: false,
						emitLegacyCitationMetadata,
					});
				}
			}
		}
	}

	return specs;
}

describe("adapter options matrix", () => {
	const rows = buildAdapterOptionsRows(buildSpecs());
	const jsonRows = rows.filter((row) => row.spec.scenario === "json-text");
	const strictRows = rows.filter((row) => row.spec.scenario === "strict-tool-invalid");
	const recoverRows = rows.filter((row) => row.spec.scenario === "recover-malformed");
	const legacyRows = rows.filter((row) => row.spec.scenario === "legacy-citation");

	it("LSA-OPT01: matrix has >= 120 meaningful rows", () => {
		expect(rows.length).toBeGreaterThanOrEqual(120);
	});

	it("LSA-OPT02: matrix includes all four scenarios", () => {
		expect(new Set(rows.map((row) => row.spec.scenario))).toEqual(
			new Set(["json-text", "strict-tool-invalid", "recover-malformed", "legacy-citation"]),
		);
	});

	it("LSA-OPT03: matrix spans all adapter families", () => {
		expect(new Set(rows.map((row) => row.spec.adapterFamily))).toEqual(new Set(ALL_ADAPTERS));
	});

	it("LSA-OPT04: json scenario contributes >= 56 rows", () => {
		expect(jsonRows.length).toBeGreaterThanOrEqual(56);
	});

	it("LSA-OPT05: strict scenario contributes >= 28 rows", () => {
		expect(strictRows.length).toBeGreaterThanOrEqual(28);
	});

	it("LSA-OPT06: recover scenario contributes >= 28 rows", () => {
		expect(recoverRows.length).toBeGreaterThanOrEqual(28);
	});

	it("LSA-OPT07: legacy scenario contributes >= 24 rows", () => {
		expect(legacyRows.length).toBeGreaterThanOrEqual(24);
	});

	it("LSA-OPT08: matrix includes jsonMode=true rows", () => {
		expect(rows.some((row) => row.spec.jsonMode)).toBe(true);
	});

	it("LSA-OPT09: matrix includes strictToolArgs=true rows", () => {
		expect(rows.some((row) => row.spec.strictToolArgs)).toBe(true);
	});

	it("LSA-OPT10: matrix includes recoverMalformed=true rows", () => {
		expect(rows.some((row) => row.spec.recoverMalformed)).toBe(true);
	});

	it("LSA-OPT11: matrix includes emitLegacyCitationMetadata=true rows", () => {
		expect(rows.some((row) => row.spec.emitLegacyCitationMetadata)).toBe(true);
	});

	it("LSA-OPT12: matrix includes emitLegacyCitationMetadata=false rows", () => {
		expect(rows.some((row) => !row.spec.emitLegacyCitationMetadata)).toBe(true);
	});

	it("LSA-OPT13: matrix includes jsonMode=false rows", () => {
		expect(rows.some((row) => !row.spec.jsonMode)).toBe(true);
	});

	it("LSA-OPT14: matrix includes strictToolArgs=false rows", () => {
		expect(rows.some((row) => !row.spec.strictToolArgs)).toBe(true);
	});

	it("LSA-OPT15: matrix includes recoverMalformed=false rows", () => {
		expect(rows.some((row) => !row.spec.recoverMalformed)).toBe(true);
	});

	it.each(jsonRows)("LSA-OPT16 $label respects jsonMode mapping", async (row) => {
		const events = await runRow(row);
		if (row.spec.jsonMode) {
			expect(events.some((event) => event.type === "json.delta")).toBe(true);
			expect(events.some((event) => event.type === "text.delta")).toBe(false);
		} else {
			expect(events.some((event) => event.type === "text.delta")).toBe(true);
			expect(events.some((event) => event.type === "json.delta")).toBe(false);
		}
		expect(events.some((event) => event.type === "finish")).toBe(true);
	});

	it.each(strictRows)("LSA-OPT17 $label enforces strictToolArgs", async (row) => {
		if (row.spec.strictToolArgs) {
			await expect(runRow(row)).rejects.toThrow();
			return;
		}
		const events = await runRow(row);
		expect(events.some((event) => event.type === "tool_call.done")).toBe(true);
		expect(events.some((event) => event.type === "finish")).toBe(true);
	});

	it.each(recoverRows)("LSA-OPT18 $label enforces recoverMalformed", async (row) => {
		if (!row.spec.recoverMalformed) {
			await expect(runRow(row)).rejects.toThrow();
			return;
		}
		const events = await runRow(row);
		expect(hasRecoverableError(events)).toBe(true);
		expect(events.some((event) => event.type === "finish")).toBe(true);
	});

	it.each(legacyRows)("LSA-OPT19 $label toggles legacy citation metadata", async (row) => {
		const events = await runRow(row);
		expect(events.some((event) => event.type === "citation")).toBe(true);
		expect(row.hasLegacyMetadata(events)).toBe(row.spec.emitLegacyCitationMetadata);
		expect(events.some((event) => event.type === "finish")).toBe(true);
	});

	it("LSA-OPT20: strict=true rows consistently throw on invalid tool args", async () => {
		for (const row of strictRows.filter((entry) => entry.spec.strictToolArgs)) {
			await expect(runRow(row)).rejects.toThrow();
		}
	});

	it("LSA-OPT21: strict=false rows consistently emit tool_call.done", async () => {
		for (const row of strictRows.filter((entry) => !entry.spec.strictToolArgs)) {
			const events = await runRow(row);
			expect(events.some((event) => event.type === "tool_call.done")).toBe(true);
		}
	});

	it("LSA-OPT22: recover=true rows emit recoverable error events", async () => {
		for (const row of recoverRows.filter((entry) => entry.spec.recoverMalformed)) {
			const events = await runRow(row);
			expect(hasRecoverableError(events)).toBe(true);
		}
	});

	it("LSA-OPT23: recover=false rows throw on malformed payloads", async () => {
		for (const row of recoverRows.filter((entry) => !entry.spec.recoverMalformed)) {
			await expect(runRow(row)).rejects.toThrow();
		}
	});

	it("LSA-OPT24: legacy=true rows emit metadata duplicates for citations", async () => {
		for (const row of legacyRows.filter((entry) => entry.spec.emitLegacyCitationMetadata)) {
			const events = await runRow(row);
			expect(row.hasLegacyMetadata(events)).toBe(true);
		}
	});

	it("LSA-OPT25: legacy=false rows keep citation events without metadata duplicates", async () => {
		for (const row of legacyRows.filter((entry) => !entry.spec.emitLegacyCitationMetadata)) {
			const events = await runRow(row);
			expect(events.some((event) => event.type === "citation")).toBe(true);
			expect(row.hasLegacyMetadata(events)).toBe(false);
		}
	});
});

async function runRow(row: AdapterOptionsMatrixRow): Promise<StreamEvent[]> {
	return collectAsync(
		assembleFromPayloads(strings(...row.payloads), row.adapter, row.assembleOptions),
	);
}

function hasRecoverableError(events: StreamEvent[]): boolean {
	return events.some((event) => event.type === "error" && event.recoverable === true);
}
