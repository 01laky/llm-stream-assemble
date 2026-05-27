export interface CitationSpanAnchorInput {
	assistantText?: string;
	span?: { start: number; end: number; text?: string };
}

export interface CitationSpanAnchorResult {
	anchorText?: string;
	consistent: boolean;
}

export function citationSpanAnchor(input: CitationSpanAnchorInput): CitationSpanAnchorResult {
	const span = input.span;
	if (!span) {
		return { consistent: false };
	}

	const spanText = span.text?.trim();
	if (input.assistantText === undefined || input.assistantText.length === 0) {
		const fallback = span.text ?? spanText;
		if (fallback) {
			return { anchorText: fallback, consistent: true };
		}
		return { consistent: false };
	}

	const { start, end } = span;
	if (start < 0 || end < start || end > input.assistantText.length) {
		return { consistent: false };
	}

	const anchorText = input.assistantText.slice(start, end);
	if (spanText !== undefined && spanText.length > 0 && spanText !== anchorText.trim()) {
		return { anchorText, consistent: false };
	}

	return { anchorText, consistent: true };
}
