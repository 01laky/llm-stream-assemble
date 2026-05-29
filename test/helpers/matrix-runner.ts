import { describe, expect, it } from "vitest";

export type MatrixProfile =
	| "tier1-standard"
	| "tier1-evil-full"
	| "tier2"
	| "edge-catalog"
	| "response-chunk"
	| "invariants-only"
	| "compatible-presets"
	| "logprobs-combinatorial";

export interface GoldenMatrixRow {
	id: string;
	label: string;
	run: () => void | Promise<void>;
}

export interface DefineGoldenMatrixOptions {
	name: string;
	profile: MatrixProfile;
	gateId?: string;
	minRows?: number;
	rows: GoldenMatrixRow[];
	withInvariants?: boolean;
	withEventOrdering?: boolean;
}

export function defineGoldenMatrix(opts: DefineGoldenMatrixOptions): void {
	describe(`${opts.name} [${opts.profile}]`, () => {
		if (opts.gateId && opts.minRows !== undefined) {
			it(`LSA-${opts.gateId}: matrix row count >= ${opts.minRows}`, () => {
				expect(opts.rows.length).toBeGreaterThanOrEqual(opts.minRows);
			});
		}

		for (const row of opts.rows) {
			it(`LSA-${row.id}: ${row.label}`, async () => {
				await row.run();
			});
		}
	});
}
