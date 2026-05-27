import { describe, expect, it } from "vitest";
import { logprobConfidence } from "../src/helpers/logprob-confidence";

describe("logprob confidence helper", () => {
	it("LSA-LPH01: standard logprob converts to probability", () => {
		const result = logprobConfidence({ logprob: -0.693 });
		expect(result.probability).toBeCloseTo(0.5, 3);
	});

	it("LSA-LPH02: top-two margin computed", () => {
		const result = logprobConfidence({
			logprob: -0.1,
			topLogprobs: [
				{ token: "a", logprob: -0.1 },
				{ token: "b", logprob: -1.5 },
			],
		});
		expect(result.margin).toBeCloseTo(1.4, 5);
		expect(result.runnerUpToken).toBe("b");
	});

	it("LSA-LPH03: single top_logprob yields no margin", () => {
		const result = logprobConfidence({
			logprob: -0.1,
			topLogprobs: [{ token: "only", logprob: -0.1 }],
		});
		expect(result.margin).toBeUndefined();
		expect(result.runnerUpToken).toBeUndefined();
	});

	it("LSA-LPH04: non-finite logprob yields undefined probability", () => {
		expect(logprobConfidence({ logprob: Number.NaN }).probability).toBeUndefined();
		expect(logprobConfidence({ logprob: Number.POSITIVE_INFINITY }).probability).toBeUndefined();
	});

	it("LSA-LPA06: logprob zero maps to probability one", () => {
		const result = logprobConfidence({ logprob: 0 });
		expect(result.probability).toBe(1);
	});

	it("LSA-LPH05: positive logprob skips probability conversion", () => {
		expect(logprobConfidence({ logprob: 0.5 }).probability).toBeUndefined();
	});

	it("LSA-LPH06: unsorted topLogprobs still compute margin from best two", () => {
		const result = logprobConfidence({
			logprob: -0.2,
			topLogprobs: [
				{ token: "runner", logprob: -1.2 },
				{ token: "best", logprob: -0.2 },
				{ token: "third", logprob: -2.0 },
			],
		});
		expect(result.margin).toBeCloseTo(1.0, 5);
		expect(result.runnerUpToken).toBe("runner");
	});

	it("LSA-LPH07: topLogprobs with non-finite runner-up omits margin", () => {
		const result = logprobConfidence({
			logprob: -0.1,
			topLogprobs: [
				{ token: "a", logprob: -0.1 },
				{ token: "b", logprob: Number.NaN },
			],
		});
		expect(result.margin).toBeUndefined();
		expect(result.runnerUpToken).toBeUndefined();
	});

	it("LSA-LPH08: empty topLogprobs array yields probability only", () => {
		const result = logprobConfidence({
			logprob: -0.693,
			topLogprobs: [],
		});
		expect(result.probability).toBeCloseTo(0.5, 3);
		expect(result.margin).toBeUndefined();
	});
});
