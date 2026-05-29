export type GeminiApiSurface = "google-ai" | "vertex";

export interface GeminiAdapterOptions {
	/** Map text parts to json-delta instead of text-delta. */
	jsonMode?: boolean;
	/**
	 * Which Gemini HTTP API produced the chunk JSON.
	 * @default "google-ai"
	 */
	apiSurface?: GeminiApiSurface;
	/** @deprecated Dual-emit legacy metadata.raw citation blobs alongside typed events. */
	emitLegacyCitationMetadata?: boolean;
}

export interface ToolState {
	id: string;
	name: string;
	index: number;
	choiceIndex: number;
	lastArgsJson: string;
	open: boolean;
}
