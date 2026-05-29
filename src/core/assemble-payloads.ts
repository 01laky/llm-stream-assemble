import type { AssembleOptions, StreamAdapter, StreamEvent } from "./types";
import { AssemblySession } from "./assembly/session";

export function assembleFromPayloads(
	payloads: AsyncIterable<string>,
	adapter: StreamAdapter,
	options: AssembleOptions = {},
): AsyncIterable<StreamEvent> {
	return assembleFromPayloadsGenerator(payloads, adapter, options);
}

async function* assembleFromPayloadsGenerator(
	payloads: AsyncIterable<string>,
	adapter: StreamAdapter,
	options: AssembleOptions,
): AsyncIterable<StreamEvent> {
	const session = AssemblySession.create(adapter, options);
	const iterator = payloads[Symbol.asyncIterator]();

	try {
		while (true) {
			if (session.isAborted()) {
				yield* session.terminalFlush();
				return;
			}

			const item = await iterator.next();
			if (item.done) break;

			yield* session.handlePayload(item.value);
		}

		yield* session.terminalFlush();
	} finally {
		await iterator.return?.();
	}
}
