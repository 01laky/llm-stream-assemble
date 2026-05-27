import type { RawChunk } from "../../core/types";

export interface TextOrJsonDeltaOptions {
	jsonMode?: boolean | undefined;
	choiceIndex?: number | undefined;
}

export function textOrJsonDelta(
	text: string,
	options: TextOrJsonDeltaOptions,
): RawChunk | undefined {
	if (text.length === 0) return undefined;
	if (options.jsonMode) return { kind: "json-delta", delta: text };
	if (options.choiceIndex !== undefined) {
		return { kind: "text-delta", text, choiceIndex: options.choiceIndex };
	}
	return { kind: "text-delta", text };
}
