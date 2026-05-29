import type { RawChunk } from "../../core/types";
import { asNumber, asString, isRecord, optionalRawChunk } from "../utils";

export interface CitationGroundingOptions {
	emitLegacyCitationMetadata?: boolean;
}

type CitationChunk = Extract<RawChunk, { kind: "citation" }>;
type GroundingChunk = Extract<RawChunk, { kind: "grounding" }>;

export function cohereCitationFromStartPayload(
	citations: unknown,
	index?: number,
	options: CitationGroundingOptions = {},
): RawChunk[] {
	const chunks: RawChunk[] = [];
	const citation = citationChunkFromCohere(citations, index);
	if (citation) chunks.push(citation);
	if (options.emitLegacyCitationMetadata && citations !== undefined) {
		chunks.push(
			optionalRawChunk({
				kind: "metadata",
				raw: { citation: citations, index },
			}),
		);
	}
	return chunks;
}

function citationChunkFromCohere(citations: unknown, index?: number): RawChunk | undefined {
	if (citations === undefined) return undefined;

	const chunk: CitationChunk = { kind: "citation", raw: { citation: citations, index } };
	const numericIndex = asNumber(index);
	if (numericIndex !== undefined) chunk.index = numericIndex;

	if (isRecord(citations)) {
		const start = asNumber(citations.start);
		const end = asNumber(citations.end);
		const text = asString(citations.text);
		if (start !== undefined && end !== undefined) {
			chunk.span = { start, end, ...(text ? { text } : {}) };
		} else if (text) {
			chunk.span = { start: 0, end: text.length, text };
		}
		const sources = citations.sources;
		if (Array.isArray(sources) && sources.length > 0) {
			chunk.sources = sources;
		}
	}

	return optionalRawChunk(chunk);
}

export function perplexityCitationFromPayload(
	payload: Record<string, unknown>,
	options: CitationGroundingOptions = {},
): RawChunk[] {
	const citations = payload.citations;
	const searchResults = payload.search_results;
	const hasCitations = Array.isArray(citations) && citations.length > 0;
	const hasSearchResults = Array.isArray(searchResults) && searchResults.length > 0;
	if (!hasCitations && !hasSearchResults) return [];

	const urls = hasCitations
		? citations.filter((item): item is string => typeof item === "string")
		: undefined;

	const chunk: CitationChunk = {
		kind: "citation",
		raw: {
			...(hasCitations ? { citations } : {}),
			...(hasSearchResults ? { search_results: searchResults } : {}),
		},
	};
	if (urls && urls.length > 0) chunk.urls = urls;
	if (hasSearchResults) chunk.searchResults = searchResults as unknown[];

	const chunks: RawChunk[] = [optionalRawChunk(chunk)!];
	if (options.emitLegacyCitationMetadata) {
		chunks.push(
			optionalRawChunk({
				kind: "metadata",
				raw: {
					...(hasCitations ? { citations } : {}),
					...(hasSearchResults ? { search_results: searchResults } : {}),
				},
			}),
		);
	}
	return chunks;
}

export function geminiCitationGroundingFromCandidate(
	candidate: Record<string, unknown>,
	options: CitationGroundingOptions = {},
): RawChunk[] {
	const chunks: RawChunk[] = [];
	const citationMetadata = candidate.citationMetadata;
	const groundingMetadata = candidate.groundingMetadata;

	if (citationMetadata !== undefined) {
		const citation = citationChunkFromGemini(citationMetadata);
		if (citation) chunks.push(citation);
	}
	if (groundingMetadata !== undefined) {
		const grounding = groundingChunkFromGemini(groundingMetadata);
		if (grounding) chunks.push(grounding);
	}

	if (
		options.emitLegacyCitationMetadata &&
		(citationMetadata !== undefined || groundingMetadata !== undefined)
	) {
		chunks.push(
			optionalRawChunk({
				kind: "metadata",
				raw: { citationMetadata, groundingMetadata },
			}),
		);
	}

	return chunks;
}

function citationChunkFromGemini(citationMetadata: unknown): RawChunk | undefined {
	if (citationMetadata === undefined) return undefined;
	const chunk: CitationChunk = { kind: "citation", raw: citationMetadata };
	if (isRecord(citationMetadata) && Array.isArray(citationMetadata.citations)) {
		chunk.sources = citationMetadata.citations as unknown[];
	}
	return optionalRawChunk(chunk);
}

function groundingChunkFromGemini(groundingMetadata: unknown): RawChunk | undefined {
	if (groundingMetadata === undefined) return undefined;
	const chunk: GroundingChunk = { kind: "grounding", raw: groundingMetadata };
	if (isRecord(groundingMetadata)) {
		if (Array.isArray(groundingMetadata.webSearchQueries)) {
			chunk.queries = groundingMetadata.webSearchQueries as string[];
		}
		if (Array.isArray(groundingMetadata.groundingChunks)) {
			chunk.chunks = groundingMetadata.groundingChunks as unknown[];
		}
		if (Array.isArray(groundingMetadata.groundingSupports)) {
			chunk.supports = groundingMetadata.groundingSupports as unknown[];
		}
	}
	return optionalRawChunk(chunk);
}

export function payloadWithoutCitationRootFields(
	payload: Record<string, unknown>,
): Record<string, unknown> {
	const next = { ...payload };
	delete next.citations;
	delete next.search_results;
	return next;
}

export function metadataPayloadWithoutCitationFields(
	payload: Record<string, unknown>,
): Record<string, unknown> {
	return payloadWithoutCitationRootFields(payload);
}
