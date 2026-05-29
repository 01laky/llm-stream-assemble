const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const DETERMINISTIC_SEEDS = [
	11, 23, 37, 41, 53, 67, 79, 83, 97, 101, 131, 149, 167, 181, 197, 211,
] as const;

export type DeterministicMutatorKind =
	| "truncate-at-byte"
	| "flip-brace"
	| "insert-null"
	| "duplicate-line"
	| "split-json-string";

export interface DeterministicMutator {
	kind: DeterministicMutatorKind;
	mutate: (input: string, seed: number) => string;
}

export const DETERMINISTIC_MUTATORS: readonly DeterministicMutator[] = [
	{ kind: "truncate-at-byte", mutate: truncateAtByte },
	{ kind: "flip-brace", mutate: flipBrace },
	{ kind: "insert-null", mutate: insertNull },
	{ kind: "duplicate-line", mutate: duplicateLine },
	{ kind: "split-json-string", mutate: splitJsonString },
] as const;

export function mutateDeterministically(
	input: string,
	seed: number,
	kind: DeterministicMutatorKind,
): string {
	const mutator = DETERMINISTIC_MUTATORS.find((entry) => entry.kind === kind);
	if (!mutator) return input;
	return mutator.mutate(input, seed);
}

function truncateAtByte(input: string, seed: number): string {
	const bytes = encoder.encode(input);
	if (bytes.length <= 1) return input;
	const cut = 1 + pick(seed, bytes.length - 1);
	return decoder.decode(bytes.subarray(0, cut));
}

function flipBrace(input: string, seed: number): string {
	const indices: number[] = [];
	for (let i = 0; i < input.length; i += 1) {
		const value = input[i];
		if (value === "{" || value === "}") indices.push(i);
	}
	if (indices.length === 0) return input;
	const index = indices[pick(seed, indices.length)] ?? 0;
	const current = input[index] ?? "{";
	const flipped = current === "{" ? "}" : "{";
	return `${input.slice(0, index)}${flipped}${input.slice(index + 1)}`;
}

function insertNull(input: string, seed: number): string {
	const index = pick(seed, input.length + 1);
	return `${input.slice(0, index)}\u0000${input.slice(index)}`;
}

function duplicateLine(input: string, seed: number): string {
	const lines = input.split("\n");
	if (lines.length === 0) return input;
	const index = pick(seed, lines.length);
	const line = lines[index] ?? "";
	const next = [...lines.slice(0, index + 1), line, ...lines.slice(index + 1)];
	return next.join("\n");
}

function splitJsonString(input: string, seed: number): string {
	const spans = quotedStringSpans(input);
	if (spans.length === 0) {
		if (input.length === 0) return "\n";
		const index = pick(seed, input.length);
		return `${input.slice(0, index)}\n${input.slice(index)}`;
	}

	const span = spans[pick(seed, spans.length)]!;
	const interiorLength = span.end - span.start - 1;
	if (interiorLength <= 1) return input;
	const cut = span.start + 1 + pick(seed + 17, interiorLength - 1);
	return `${input.slice(0, cut)}\n${input.slice(cut)}`;
}

function quotedStringSpans(input: string): Array<{ start: number; end: number }> {
	const spans: Array<{ start: number; end: number }> = [];
	let start = -1;
	let escaped = false;

	for (let i = 0; i < input.length; i += 1) {
		const char = input[i];
		if (char === "\\" && !escaped) {
			escaped = true;
			continue;
		}
		if (char === '"' && !escaped) {
			if (start === -1) start = i;
			else {
				spans.push({ start, end: i });
				start = -1;
			}
		}
		escaped = false;
	}
	return spans.filter((span) => span.end - span.start >= 2);
}

function pick(seed: number, size: number): number {
	if (size <= 0) return 0;
	const normalized = Math.imul(seed, 1103515245) + 12345;
	return Math.abs(normalized) % size;
}
