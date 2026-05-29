import { defineConfig } from "vitest/config";

const matrixIncludes = [
	"test/**/*matrix*.test.ts",
	"test/chunk-split-evil-full.test.ts",
	"test/responses-logprobs-combinatorial.test.ts",
];

export default defineConfig({
	test: {
		projects: [
			{
				extends: true,
				test: {
					name: "unit",
					include: ["test/**/*.test.ts"],
					exclude: matrixIncludes,
					maxWorkers: 2,
				},
			},
			{
				extends: true,
				test: {
					name: "matrix",
					include: matrixIncludes,
					maxWorkers: 1,
					fileParallelism: false,
				},
			},
		],
	},
});
