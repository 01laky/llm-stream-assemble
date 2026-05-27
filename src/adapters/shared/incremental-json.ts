/** Tracks last serialized JSON for prefix-diff tool arg deltas. */
export interface IncrementalJsonState {
	lastArgsJson: string;
}

/** Emit only the new suffix when `nextInput` extends `prev`, else full replace. */
export function incrementalJsonStringDelta(
	state: IncrementalJsonState,
	nextInput: string,
): string | undefined {
	const prev = state.lastArgsJson;
	if (nextInput === prev) return undefined;
	const delta =
		prev.length > 0 && nextInput.startsWith(prev) ? nextInput.slice(prev.length) : nextInput;
	state.lastArgsJson = nextInput;
	return delta.length > 0 ? delta : undefined;
}
