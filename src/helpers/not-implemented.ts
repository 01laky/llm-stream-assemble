/**
 * @deprecated Internal scaffold helper retained for patch-level compatibility.
 * Do not use in application code.
 */
export function notImplemented(feature: string): never {
	throw new Error(`llm-stream-assemble: ${feature} is not implemented yet`);
}

/**
 * @deprecated Internal scaffold helper retained for patch-level compatibility.
 * Do not use in application code.
 */
export function notImplementedAsyncIterable<T>(feature: string): AsyncIterable<T> {
	return {
		[Symbol.asyncIterator]() {
			return {
				next(): Promise<IteratorResult<T>> {
					notImplemented(feature);
				},
			};
		},
	};
}
