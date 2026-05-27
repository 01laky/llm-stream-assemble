export interface LogprobConfidenceInput {
	logprob: number;
	topLogprobs?: Array<{ token: string; logprob: number }>;
}

export interface LogprobConfidenceResult {
	probability?: number;
	margin?: number;
	runnerUpToken?: string;
}

export function logprobConfidence(input: LogprobConfidenceInput): LogprobConfidenceResult {
	const result: LogprobConfidenceResult = {};
	if (Number.isFinite(input.logprob) && input.logprob <= 0) {
		result.probability = Math.exp(input.logprob);
	}

	const top = input.topLogprobs;
	if (top && top.length >= 2) {
		const sorted = [...top].sort((left, right) => right.logprob - left.logprob);
		const best = sorted[0];
		const runnerUp = sorted[1];
		if (best && runnerUp && Number.isFinite(best.logprob) && Number.isFinite(runnerUp.logprob)) {
			result.margin = best.logprob - runnerUp.logprob;
			result.runnerUpToken = runnerUp.token;
		}
	}

	return result;
}
