import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { anthropicAdapter } from "../src/adapters/anthropic";
import { bedrockAdapter } from "../src/adapters/bedrock";
import { cohereAdapter } from "../src/adapters/cohere";
import { geminiAdapter } from "../src/adapters/gemini";
import { openaiChatAdapter } from "../src/adapters/openai-chat";
import { assembleFromPayloads } from "../src/core/assemble-payloads";
import { assembleStream } from "../src/core/assemble-stream";
import type { StreamAdapter, StreamEvent } from "../src/core/types";
import { byteStreamFromSplitString, jsonlLinesFromByteStream } from "./helpers/byte-stream";
import { collectAsync } from "./helpers/collect-events";
import { DETERMINISTIC_MUTATORS, DETERMINISTIC_SEEDS } from "./helpers/deterministic-mutators";

type Transport = "sse" | "jsonl";

interface FamilyFixture {
	family: string;
	transport: Transport;
	adapterFactory: () => StreamAdapter;
	raw: string;
}

const fixturesRoot = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

const familyFixtures: readonly FamilyFixture[] = [
	{
		family: "openai-chat",
		transport: "sse",
		adapterFactory: () => openaiChatAdapter(),
		raw: readFixture("openai-chat/text-basic.sse"),
	},
	{
		family: "anthropic",
		transport: "sse",
		adapterFactory: () => anthropicAdapter(),
		raw: readFixture("anthropic/text-basic.sse"),
	},
	{
		family: "gemini",
		transport: "sse",
		adapterFactory: () => geminiAdapter(),
		raw: readFixture("gemini/text-basic.sse"),
	},
	{
		family: "cohere",
		transport: "jsonl",
		adapterFactory: () => cohereAdapter(),
		raw: readFixture("cohere/text-basic.jsonl"),
	},
	{
		family: "bedrock",
		transport: "jsonl",
		adapterFactory: () => bedrockAdapter(),
		raw: readFixture("bedrock/text-basic.jsonl"),
	},
];

describe("deterministic seed matrix", () => {
	const matrixRows = DETERMINISTIC_SEEDS.flatMap((seed) =>
		familyFixtures.map((fixture) => ({
			seed,
			fixture,
			label: `seed=${seed} family=${fixture.family}`,
		})),
	);

	it("LSA-SD01: deterministic matrix has >= 80 rows", () => {
		expect(matrixRows.length).toBeGreaterThanOrEqual(80);
	});

	it("LSA-SD02: helper exports exactly 16 fixed seeds", () => {
		expect(DETERMINISTIC_SEEDS).toHaveLength(16);
	});

	it("LSA-SD03: helper exports exactly five mutators", () => {
		expect(DETERMINISTIC_MUTATORS.map((mutator) => mutator.kind)).toEqual([
			"truncate-at-byte",
			"flip-brace",
			"insert-null",
			"duplicate-line",
			"split-json-string",
		]);
	});

	it.each(matrixRows)(
		"LSA-SD04 $label is deterministic across mutators",
		async ({ seed, fixture }) => {
			for (const mutator of DETERMINISTIC_MUTATORS) {
				const mutatedA = mutator.mutate(fixture.raw, seed);
				const mutatedB = mutator.mutate(fixture.raw, seed);
				expect(mutatedA).toBe(mutatedB);

				const eventsA = await assembleMutated(
					mutatedA,
					fixture.transport,
					fixture.adapterFactory(),
				);
				const eventsB = await assembleMutated(
					mutatedB,
					fixture.transport,
					fixture.adapterFactory(),
				);
				expect(normalizeEvents(eventsA)).toEqual(normalizeEvents(eventsB));
			}
		},
	);
});

function readFixture(relativePath: string): string {
	return readFileSync(join(fixturesRoot, relativePath), "utf8");
}

async function assembleMutated(
	raw: string,
	transport: Transport,
	adapter: StreamAdapter,
): Promise<StreamEvent[]> {
	const stream = byteStreamFromSplitString(raw, 1);
	if (transport === "sse") {
		return collectAsync(assembleStream(stream, adapter, { recoverMalformed: true }));
	}
	return collectAsync(
		assembleFromPayloads(jsonlLinesFromByteStream(stream), adapter, { recoverMalformed: true }),
	);
}

function normalizeEvents(events: StreamEvent[]): unknown[] {
	return events.map((event) => {
		if (event.type !== "error") return event;
		return {
			...event,
			error: event.error.message,
		};
	});
}
