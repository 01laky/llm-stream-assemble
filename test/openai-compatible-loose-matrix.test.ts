import { describe, it } from "vitest";
import { LOOSE_HOST_PRESETS } from "./helpers/compatible-preset-matrix";
import {
	assertEmptyObjectBehavior,
	assertLooseStringErrorMapsToProviderError,
	assertMalformedJsonPrefix,
	assertReasoningContentAlias,
	assertSparseMetadataTextDelta,
	assertUnrecognizablePayloadSilent,
} from "./helpers/compatible-preset-matrix";

describe("openaiCompatibleAdapter loose host preset matrix", () => {
	it("LSA-OC211: every loose host rejects malformed JSON with adapter prefix", () => {
		for (const provider of LOOSE_HOST_PRESETS) {
			assertMalformedJsonPrefix(provider);
		}
	});

	it("LSA-OC212: every loose host parses empty object without throw", () => {
		for (const provider of LOOSE_HOST_PRESETS) {
			assertEmptyObjectBehavior(provider);
		}
	});

	it("LSA-OC213: every loose host maps loose string error to provider-error", () => {
		for (const provider of LOOSE_HOST_PRESETS) {
			assertLooseStringErrorMapsToProviderError(provider);
		}
	});

	it("LSA-OC214: every loose host parses sparse metadata text delta", () => {
		for (const provider of LOOSE_HOST_PRESETS) {
			assertSparseMetadataTextDelta(provider);
		}
	});

	it("LSA-OC215: every loose host maps reasoning_content alias", () => {
		for (const provider of LOOSE_HOST_PRESETS) {
			assertReasoningContentAlias(provider);
		}
	});

	it("LSA-OC216: every loose host silently ignores unrecognizable payloads", () => {
		for (const provider of LOOSE_HOST_PRESETS) {
			assertUnrecognizablePayloadSilent(provider);
		}
	});
});
