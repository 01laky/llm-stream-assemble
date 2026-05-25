import { notImplementedAsyncIterable } from "../helpers/not-implemented";
import type { AssembleFromFileOptions, StreamAdapter, StreamEvent } from "./types";

export function assembleFromFile(
	_path: string,
	_adapter: StreamAdapter,
	_options?: AssembleFromFileOptions,
): AsyncIterable<StreamEvent> {
	return notImplementedAsyncIterable<StreamEvent>("assembleFromFile");
}
