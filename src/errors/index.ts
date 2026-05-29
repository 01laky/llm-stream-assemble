export {
	libraryError,
	adapterScopedError,
	providerErrorChunksFromPayload,
} from "../adapters/errors";

export { prefixedError, errorFromUnknown } from "../core/utils/source";

import { adapterScopedError } from "../adapters/errors";

export function prefixedAdapterError(scope: string, message: string): Error {
	return adapterScopedError(scope, message);
}
