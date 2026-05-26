import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { openaiCompatibleAdapter } from "../src/adapters/openai-compatible";
import { runAdapterGoldenStream } from "./helpers/adapter-conformance";
import {
	expectedHostCompatibleEvents,
	normalizeCompatibleEvents,
} from "./helpers/compatible-fixtures";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures/openai-compatible");

describe("openaiCompatibleAdapter host preset conformance", () => {
	it("LSA-OC85: runAdapterGoldenStream parity for groq and deepseek text-basic", async () => {
		for (const host of ["groq", "deepseek"] as const) {
			const events = normalizeCompatibleEvents(
				await runAdapterGoldenStream({
					adapter: openaiCompatibleAdapter({ provider: host }),
					fixtureSsePath: join(fixturesDir, host, "text-basic.sse"),
					expectedEventsPath: join(fixturesDir, host, "text-basic.expected.json"),
					adapterFactory: () => openaiCompatibleAdapter({ provider: host }),
				}),
			);
			expect(events).toEqual(expectedHostCompatibleEvents(host, "text-basic"));
		}
	});

	it("LSA-OC102: runAdapterGoldenStream parity for perplexity and xai text-basic", async () => {
		for (const host of ["perplexity", "xai"] as const) {
			const events = normalizeCompatibleEvents(
				await runAdapterGoldenStream({
					adapter: openaiCompatibleAdapter({ provider: host }),
					fixtureSsePath: join(fixturesDir, host, "text-basic.sse"),
					expectedEventsPath: join(fixturesDir, host, "text-basic.expected.json"),
					adapterFactory: () => openaiCompatibleAdapter({ provider: host }),
				}),
			);
			expect(events).toEqual(expectedHostCompatibleEvents(host, "text-basic"));
		}
	});

	it("LSA-OC130: runAdapterGoldenStream parity for azure/text-basic", async () => {
		const events = normalizeCompatibleEvents(
			await runAdapterGoldenStream({
				adapter: openaiCompatibleAdapter({ provider: "azure" }),
				fixtureSsePath: join(fixturesDir, "azure", "text-basic.sse"),
				expectedEventsPath: join(fixturesDir, "azure", "text-basic.expected.json"),
				adapterFactory: () => openaiCompatibleAdapter({ provider: "azure" }),
			}),
		);
		expect(events).toEqual(expectedHostCompatibleEvents("azure", "text-basic"));
	});
});

describe("openaiCompatibleAdapter host preset fixture drift", () => {
	it("LSA-OC86: generate-compatible-preset-fixtures --check reports all host fixtures unchanged", async () => {
		const { spawnSync } = await import("node:child_process");
		const script = join(
			dirname(fileURLToPath(import.meta.url)),
			"../scripts/generate-compatible-preset-fixtures.mjs",
		);
		const result = spawnSync(process.execPath, [script, "--check"], {
			cwd: join(dirname(fileURLToPath(import.meta.url)), ".."),
			encoding: "utf8",
		});
		expect(result.status, result.stderr || result.stdout).toBe(0);
		expect(result.stdout).toContain("unchanged");
	});
});
