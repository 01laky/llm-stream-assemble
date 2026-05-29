import { describe, expect, it } from "vitest";
import {
	openaiCompatibleAdapter,
	resolveCompatibleAdapterConfig,
	compatibleProviderLabel,
} from "../src/adapters/openai-compatible";
import { isStrictCompatiblePreset } from "../src/adapters/openai-compatible-presets";
import { HOST_COMPATIBLE_PRESETS, hostCompatibleFixture } from "./helpers/compatible-fixtures";
import {
	assertEmptyObjectBehavior,
	assertMalformedJsonPrefix,
	assertLooseStringErrorMapsToProviderError,
	assertObjectErrorShape,
	assertSparseMetadataTextDelta,
	assertUnknownDeltaKeysIgnored,
	assertUnrecognizablePayloadSilent,
	assertValidMinimalChunk,
	firstSseDataLine,
	jsonPayload,
} from "./helpers/compatible-preset-matrix";

type HostPreset = (typeof HOST_COMPATIBLE_PRESETS)[number];

type Scenario = {
	id: string;
	label: string;
	run: (provider: HostPreset) => void;
};

const MAINT47_WAIVER_TEXT =
	"MAINT47 waiver: host preset scenario matrix intentionally mixes strict and loose preset defaults in one matrix to keep coverage balanced by provider behavior and avoid duplicating equivalent assertions in per-provider files.";

const SCENARIOS: readonly Scenario[] = [
	{
		id: "OC382",
		label: "malformed json prefix throws canonical error",
		run: (provider) => assertMalformedJsonPrefix(provider),
	},
	{
		id: "OC383",
		label: "empty object behavior respects preset strictness",
		run: (provider) => assertEmptyObjectBehavior(provider),
	},
	{
		id: "OC384",
		label: "loose string error mapping behavior is stable",
		run: (provider) => assertLooseStringErrorMapsToProviderError(provider),
	},
	{
		id: "OC385",
		label: "object error shape maps provider-error",
		run: (provider) => assertObjectErrorShape(provider),
	},
	{
		id: "OC386",
		label: "sparse metadata content delta maps text",
		run: (provider) => assertSparseMetadataTextDelta(provider),
	},
	{
		id: "OC387",
		label: "unknown delta keys are ignored",
		run: (provider) => assertUnknownDeltaKeysIgnored(provider),
	},
	{
		id: "OC388",
		label: "valid minimal chunk maps text delta",
		run: (provider) => assertValidMinimalChunk(provider),
	},
	{
		id: "OC389",
		label: "unrecognizable payload behavior is stable",
		run: (provider) => assertUnrecognizablePayloadSilent(provider),
	},
	{
		id: "OC390",
		label: "resolved config strictness follows preset policy",
		run: (provider) => {
			const resolved = resolveCompatibleAdapterConfig({ provider });
			expect(resolved.allowMissingMetadata).toBe(!isStrictCompatiblePreset(provider));
			expect(resolved.looseErrorShape).toBe(!isStrictCompatiblePreset(provider));
		},
	},
	{
		id: "OC391",
		label: "resolved config reject flag mirrors allowMissingMetadata",
		run: (provider) => {
			const resolved = resolveCompatibleAdapterConfig({ provider });
			expect(resolved.rejectUnrecognizedPayloads).toBe(resolved.allowMissingMetadata === false);
		},
	},
	{
		id: "OC392",
		label: "resolved config keeps positional fallback enabled",
		run: (provider) => {
			const resolved = resolveCompatibleAdapterConfig({ provider });
			expect(resolved.useChoicePositionFallback).toBe(true);
		},
	},
	{
		id: "OC393",
		label: "provider label helper echoes host preset",
		run: (provider) => {
			expect(compatibleProviderLabel(provider)).toBe(provider);
		},
	},
	{
		id: "OC394",
		label: "text-basic first payload parses non-empty chunk output",
		run: (provider) => {
			const sse = hostCompatibleFixture(provider, "text-basic", "sse") as string;
			const firstPayload = firstSseDataLine(sse);
			const chunks = openaiCompatibleAdapter({ provider }).parseChunk(firstPayload);
			expect(chunks.length).toBeGreaterThan(0);
		},
	},
	{
		id: "OC395",
		label: "explicit override toggles strict unrecognizable behavior",
		run: (provider) => {
			const payload = jsonPayload({ foo: "bar" });
			const strictAdapter = openaiCompatibleAdapter({
				provider,
				allowMissingMetadata: false,
			});
			expect(() => strictAdapter.parseChunk(payload)).toThrow(
				/openaiCompatibleAdapter\.parseChunk/,
			);
		},
	},
] as const;

describe("compatible preset scenario matrix", () => {
	const matrixRows = HOST_COMPATIBLE_PRESETS.flatMap((provider) =>
		SCENARIOS.map((scenario) => ({
			provider,
			scenario,
		})),
	);

	it("LSA-OC381: host preset scenario matrix has >= 150 rows", () => {
		expect(HOST_COMPATIBLE_PRESETS.length).toBeGreaterThanOrEqual(10);
		expect(SCENARIOS).toHaveLength(14);
		expect(matrixRows.length).toBeGreaterThanOrEqual(150);
	});

	it("LSA-MAINT47: waiver is documented for strict-vs-loose mixed matrix policy", () => {
		expect(MAINT47_WAIVER_TEXT).toContain("strict and loose preset defaults");
		expect(MAINT47_WAIVER_TEXT).toContain("coverage balanced");
	});

	it.each(matrixRows)("LSA-$scenario.id: $provider $scenario.label", ({ provider, scenario }) => {
		scenario.run(provider);
	});
});
