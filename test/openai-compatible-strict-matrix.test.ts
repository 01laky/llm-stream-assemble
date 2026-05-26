import { describe, it } from "vitest";
import {
	assertMalformedJsonPrefix,
	assertEmptyObjectBehavior,
	assertLooseStringErrorMapsToProviderError,
	assertSparseMetadataTextDelta,
	assertReasoningContentAlias,
	assertUnrecognizablePayloadSilent,
	assertValidMinimalChunk,
	assertObjectErrorShape,
	STRICT_COMPATIBLE_PRESETS,
} from "./helpers/compatible-preset-matrix";

describe("openaiCompatibleAdapter strict host preset matrix", () => {
	it("LSA-OC218: every strict host rejects malformed JSON with adapter prefix", () => {
		for (const provider of STRICT_COMPATIBLE_PRESETS) {
			assertMalformedJsonPrefix(provider);
		}
	});

	it("LSA-OC218b: every strict host throws on empty object", () => {
		for (const provider of STRICT_COMPATIBLE_PRESETS) {
			assertEmptyObjectBehavior(provider);
		}
	});

	it("LSA-OC218c: every strict host ignores loose string errors", () => {
		for (const provider of STRICT_COMPATIBLE_PRESETS) {
			assertLooseStringErrorMapsToProviderError(provider);
		}
	});

	it("LSA-OC218d: every strict host throws on unrecognizable payloads", () => {
		for (const provider of STRICT_COMPATIBLE_PRESETS) {
			assertUnrecognizablePayloadSilent(provider);
		}
	});

	it("LSA-OC218e: every strict host parses valid minimal metadata chunk", () => {
		for (const provider of STRICT_COMPATIBLE_PRESETS) {
			assertValidMinimalChunk(provider);
		}
	});

	it("LSA-OC218f: every strict host maps object-shaped provider errors", () => {
		for (const provider of STRICT_COMPATIBLE_PRESETS) {
			assertObjectErrorShape(provider);
		}
	});

	it("LSA-OC218g: every strict host parses sparse metadata text delta", () => {
		for (const provider of STRICT_COMPATIBLE_PRESETS) {
			assertSparseMetadataTextDelta(provider);
		}
	});

	it("LSA-OC218h: every strict host maps universal reasoning_content alias", () => {
		for (const provider of STRICT_COMPATIBLE_PRESETS) {
			assertReasoningContentAlias(provider);
		}
	});
});
