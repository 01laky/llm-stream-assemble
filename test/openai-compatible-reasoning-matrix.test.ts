import { describe, it } from "vitest";
import { OPENAI_COMPATIBLE_PROVIDERS } from "../src/adapters/openai-compatible";
import {
	assertPresetReasoningField,
	PRESET_REASONING_FIELD_CASES,
} from "./helpers/compatible-preset-matrix";

describe("openaiCompatibleAdapter preset-specific reasoning matrix", () => {
	for (const testCase of PRESET_REASONING_FIELD_CASES) {
		it(`LSA-OC219: ${testCase.field} reasoning field across presets`, () => {
			for (const provider of OPENAI_COMPATIBLE_PROVIDERS) {
				const expectation = testCase.expectations[provider];
				if (!expectation) continue;
				assertPresetReasoningField(provider, testCase.field, expectation);
			}
		});
	}
});
