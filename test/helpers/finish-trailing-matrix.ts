import type { FinishReason, RawChunk } from "../../src/core/types";

/**
 * EventAssembler drop policy:
 * once a terminal finish is emitted, every later RawChunk is ignored.
 *
 * We intentionally test this with direct EventAssembler rows and adapter-level
 * integration rows to keep post-finish behavior stable across providers.
 */
export const FINISH_TRAILING_DROP_POLICY = "After finish is emitted, trailing chunks are dropped.";

export const FINISH_TRAILING_REASONS = [
	"stop",
	"tool_calls",
	"length",
	"content_filter",
	"error",
	"incomplete",
	"aborted",
] as const satisfies readonly FinishReason[];

export const FINISH_TRAILING_KINDS = [
	"text-delta",
	"reasoning-delta",
	"refusal-delta",
	"json-delta",
	"tool-start",
	"tool-args-delta",
	"tool-done",
	"citation",
	"metadata",
	"usage",
] as const;

export type FinishTrailingKind = (typeof FINISH_TRAILING_KINDS)[number];

export interface FinishTrailingRow {
	label: string;
	finishReason: FinishReason;
	trailingKind: FinishTrailingKind;
	trailingMarker: string;
	sequence: RawChunk[];
}

export function buildFinishTrailingRows(): FinishTrailingRow[] {
	return FINISH_TRAILING_REASONS.flatMap((finishReason) =>
		FINISH_TRAILING_KINDS.map((trailingKind) => {
			const trailingMarker = `late:${finishReason}:${trailingKind}`;
			return {
				label: `${finishReason} -> ${trailingKind}`,
				finishReason,
				trailingKind,
				trailingMarker,
				sequence: [
					{ kind: "text-delta", text: "lead" },
					{ kind: "finish", reason: finishReason },
					trailingChunk(trailingKind, trailingMarker),
				],
			};
		}),
	);
}

function trailingChunk(kind: FinishTrailingKind, marker: string): RawChunk {
	switch (kind) {
		case "text-delta":
			return { kind: "text-delta", text: marker };
		case "reasoning-delta":
			return { kind: "reasoning-delta", text: marker, variant: "detail" };
		case "refusal-delta":
			return { kind: "refusal-delta", text: marker };
		case "json-delta":
			return { kind: "json-delta", delta: `{"marker":"${marker}"}` };
		case "tool-start":
			return { kind: "tool-start", id: marker, name: marker, index: 0, choiceIndex: 0 };
		case "tool-args-delta":
			return { kind: "tool-args-delta", id: marker, delta: marker, index: 0, choiceIndex: 0 };
		case "tool-done":
			return { kind: "tool-done", id: marker, index: 0, choiceIndex: 0 };
		case "citation":
			return { kind: "citation", index: 0, raw: { marker } };
		case "metadata":
			return { kind: "metadata", raw: { marker } };
		case "usage":
			return { kind: "usage", raw: { marker } };
	}
}
