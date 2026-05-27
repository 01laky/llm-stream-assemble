export interface LogprobTextAlignmentInput {
	assistantText: string;
	logprobs: Array<{
		token: string;
		logprob: number;
		position?: number;
		choiceIndex?: number;
		channel?: "content" | "refusal";
	}>;
}

export interface LogprobTextAlignmentEntry {
	logprob: number;
	token: string;
	start: number;
	end: number;
	consistent: boolean;
	position?: number;
}

export interface LogprobTextAlignmentResult {
	entries: LogprobTextAlignmentEntry[];
	unaligned: number;
}

export function alignLogprobsWithText(
	input: LogprobTextAlignmentInput,
): LogprobTextAlignmentResult {
	const entries: LogprobTextAlignmentEntry[] = [];
	let cursor = 0;
	let unaligned = 0;

	for (const item of input.logprobs) {
		const index = input.assistantText.indexOf(item.token, cursor);
		if (index === -1) {
			unaligned += 1;
			continue;
		}
		const start = index;
		const end = index + item.token.length;
		const slice = input.assistantText.slice(start, end);
		entries.push({
			logprob: item.logprob,
			token: item.token,
			start,
			end,
			consistent: slice === item.token,
			...(item.position !== undefined ? { position: item.position } : {}),
		});
		cursor = end;
	}

	return { entries, unaligned };
}
