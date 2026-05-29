import { adapterScopedError } from "../errors";
import { isRecord, parseAdapterJSON } from "../utils";

export interface ParseAdapterObjectOptions {
	trim?: boolean;
	allowDone?: boolean;
}

/**
 * Parse a single adapter payload string into a JSON object.
 * Returns null for empty / [DONE] lines when configured.
 */
export function parseAdapterObjectPayload(
	raw: string,
	scope: string,
	options: ParseAdapterObjectOptions = {},
): Record<string, unknown> | null {
	const { trim = true, allowDone = true } = options;
	const input = trim ? raw.trim() : raw;
	if (input.length === 0 || (allowDone && input === "[DONE]")) return null;

	const payload = parseAdapterJSON(input, scope);
	if (!isRecord(payload)) {
		throw adapterScopedError(scope, "expected a JSON object");
	}
	return payload;
}
