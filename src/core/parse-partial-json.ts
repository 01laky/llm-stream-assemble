import type { PartialJSONResult } from "./types";

export function parsePartialJSON(input: string): PartialJSONResult {
	const trimmed = input.trim();
	if (trimmed.length === 0) {
		return { complete: false };
	}

	const complete = parseComplete(trimmed);
	if (complete.ok) {
		return { complete: true, value: complete.value };
	}

	const end = findFirstCompleteValueEnd(trimmed);
	if (end !== undefined) {
		const parsed = parseComplete(trimmed.slice(0, end));
		if (parsed.ok) {
			return { complete: false, value: parsed.value };
		}
	}

	for (const candidate of repairedCandidates(trimmed)) {
		const parsed = parseComplete(candidate);
		if (parsed.ok) {
			return { complete: false, value: parsed.value };
		}
	}

	return { complete: false };
}

function parseComplete(input: string): { ok: true; value: unknown } | { ok: false } {
	try {
		return { ok: true, value: JSON.parse(input) as unknown };
	} catch {
		return { ok: false };
	}
}

function findFirstCompleteValueEnd(input: string): number | undefined {
	let inString = false;
	let escaped = false;
	const stack: string[] = [];

	for (let index = 0; index < input.length; index += 1) {
		const char = input[index];

		if (inString) {
			if (escaped) {
				escaped = false;
			} else if (char === "\\") {
				escaped = true;
			} else if (char === '"') {
				inString = false;
				if (stack.length === 0) {
					return index + 1;
				}
			}
			continue;
		}

		if (char === '"') {
			inString = true;
		} else if (char === "{" || char === "[") {
			stack.push(char === "{" ? "}" : "]");
		} else if (char === "}" || char === "]") {
			if (stack.pop() !== char) return undefined;
			if (stack.length === 0) {
				return index + 1;
			}
		} else if (stack.length === 0 && isPrimitiveTerminator(input, index)) {
			return index;
		}
	}

	return undefined;
}

function isPrimitiveTerminator(input: string, index: number): boolean {
	if (!/[\s,}\]]/.test(input[index] ?? "")) return false;
	const prefix = input.slice(0, index).trim();
	if (prefix.length === 0) return false;
	return parseComplete(prefix).ok;
}

function repairedCandidates(input: string): string[] {
	const candidates = new Set<string>();
	const base = closeContainers(closeOpenString(input));
	candidates.add(base);

	for (const trimmed of trimDanglingValues(input)) {
		candidates.add(closeContainers(closeOpenString(trimmed)));
	}

	return [...candidates];
}

function closeOpenString(input: string): string {
	let inString = false;
	let escaped = false;

	for (const char of input) {
		if (inString) {
			if (escaped) {
				escaped = false;
			} else if (char === "\\") {
				escaped = true;
			} else if (char === '"') {
				inString = false;
			}
		} else if (char === '"') {
			inString = true;
		}
	}

	if (!inString) return input;
	return escaped ? `${input.slice(0, -1)}"` : `${input}"`;
}

function closeContainers(input: string): string {
	const stack: string[] = [];
	let inString = false;
	let escaped = false;

	for (const char of input) {
		if (inString) {
			if (escaped) {
				escaped = false;
			} else if (char === "\\") {
				escaped = true;
			} else if (char === '"') {
				inString = false;
			}
			continue;
		}

		if (char === '"') {
			inString = true;
		} else if (char === "{" || char === "[") {
			stack.push(char === "{" ? "}" : "]");
		} else if ((char === "}" || char === "]") && stack.at(-1) === char) {
			stack.pop();
		}
	}

	return `${input}${stack.reverse().join("")}`;
}

function trimDanglingValues(input: string): string[] {
	const variants: string[] = [];
	let current = input.trimEnd();

	while (current.length > 0) {
		const last = current.at(-1);
		if (last === "," || last === ":") {
			current = current.slice(0, -1).trimEnd();
			variants.push(current);
			continue;
		}

		const colon = lastTopLevelToken(current, ":");
		const comma = lastTopLevelToken(current, ",");
		const openObject = lastTopLevelToken(current, "{");
		const cutAt = Math.max(colon, comma, openObject);
		if (cutAt === -1) break;

		current = current.slice(0, cutAt + (current[cutAt] === "{" ? 1 : 0)).trimEnd();
		variants.push(current);
		break;
	}

	return variants;
}

function lastTopLevelToken(input: string, token: string): number {
	let inString = false;
	let escaped = false;
	let depth = 0;

	for (let index = input.length - 1; index >= 0; index -= 1) {
		const char = input[index];

		if (inString) {
			if (char === "\\" && !escaped) {
				escaped = true;
			} else if (char === '"' && !escaped) {
				inString = false;
			} else {
				escaped = false;
			}
			continue;
		}

		if (char === '"') {
			inString = true;
		} else if (char === "}" || char === "]") {
			depth += 1;
		} else if (char === "{" || char === "[") {
			if (depth === 0 && char === token) return index;
			depth -= 1;
		} else if (depth === 0 && char === token) {
			return index;
		}
	}

	return -1;
}
