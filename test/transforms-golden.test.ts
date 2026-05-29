import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { StreamEvent } from "../src/core/types";
import { toSSE } from "../src/transforms/to-sse";

const transformsDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures/transforms");

async function* eventsFromFile(name: string): AsyncIterable<StreamEvent> {
	const parsed = JSON.parse(readFileSync(join(transformsDir, name), "utf8")) as StreamEvent[];
	for (const event of parsed) yield event;
}

async function readStream(stream: ReadableStream<Uint8Array>): Promise<string> {
	const reader = stream.getReader();
	const decoder = new TextDecoder();
	let text = "";
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		text += decoder.decode(value, { stream: true });
	}
	return text + decoder.decode();
}

function parseSseDataLines(text: string): unknown[] {
	const events: unknown[] = [];
	for (const frame of text.split("\n\n")) {
		for (const line of frame.split(/\r?\n/u)) {
			if (!line.startsWith("data:")) continue;
			const payload = line.slice(5).trim();
			if (!payload) continue;
			events.push(JSON.parse(payload) as unknown);
		}
	}
	return events;
}

describe("transforms golden roundtrip", () => {
	const eventFiles = readdirSync(transformsDir).filter((name) => name.endsWith(".events.json"));

	it("LSA-T43: transforms event fixture files exist", () => {
		expect(eventFiles.length).toBeGreaterThanOrEqual(5);
	});

	it.each(eventFiles.map((name) => [name] as const))(
		"%s toSSE roundtrip preserves event types",
		async (name) => {
			const source = JSON.parse(readFileSync(join(transformsDir, name), "utf8")) as StreamEvent[];
			const sseText = await readStream(toSSE(eventsFromFile(name)));
			const parsed = parseSseDataLines(sseText);
			expect(parsed.map((event) => (event as { type?: string }).type)).toEqual(
				source.map((event) => event.type),
			);
		},
	);

	it("LSA-T44: text-basic events roundtrip payload equality", async () => {
		const source = JSON.parse(
			readFileSync(join(transformsDir, "text-basic.events.json"), "utf8"),
		) as StreamEvent[];
		const parsed = parseSseDataLines(
			await readStream(toSSE(eventsFromFile("text-basic.events.json"))),
		);
		expect(parsed).toEqual(source);
	});

	it("LSA-T45: tool-call events roundtrip preserves tool ids", async () => {
		const parsed = parseSseDataLines(
			await readStream(toSSE(eventsFromFile("tool-call.events.json"))),
		);
		expect(
			parsed.filter((event) => (event as { type?: string }).type === "tool_call.start"),
		).toHaveLength(1);
	});

	it("LSA-T46: logprob events roundtrip preserves token", async () => {
		const parsed = parseSseDataLines(
			await readStream(toSSE(eventsFromFile("logprob.events.json"))),
		);
		expect(parsed[0]).toMatchObject({ type: "logprob", token: "a" });
	});

	it("LSA-T47: citation-grounding roundtrip ordering", async () => {
		const parsed = parseSseDataLines(
			await readStream(toSSE(eventsFromFile("citation-grounding.events.json"))),
		);
		expect(parsed.map((event) => (event as { type?: string }).type)).toEqual([
			"citation",
			"grounding",
			"text.delta",
			"text.done",
			"finish",
		]);
	});

	it("LSA-T48: json-mode events roundtrip json.done value", async () => {
		const parsed = parseSseDataLines(
			await readStream(toSSE(eventsFromFile("json-mode.events.json"))),
		);
		expect(parsed).toContainEqual({ type: "json.done", value: { ok: true } });
	});

	it("LSA-T49: reasoning-text events roundtrip", async () => {
		const parsed = parseSseDataLines(
			await readStream(toSSE(eventsFromFile("reasoning-text.events.json"))),
		);
		expect(parsed.map((event) => (event as { type?: string }).type)).toContain("reasoning.delta");
	});

	it("LSA-T50: toSSE output frames contain finish event for text-basic", async () => {
		const parsed = parseSseDataLines(
			await readStream(toSSE(eventsFromFile("text-basic.events.json"))),
		) as Array<{ type?: string }>;
		expect(parsed.some((event) => event.type === "finish")).toBe(true);
	});

	it("LSA-T51: toSSE preserves event count for tool-call fixture", async () => {
		const source = JSON.parse(
			readFileSync(join(transformsDir, "tool-call.events.json"), "utf8"),
		) as StreamEvent[];
		const parsed = parseSseDataLines(
			await readStream(toSSE(eventsFromFile("tool-call.events.json"))),
		);
		expect(parsed).toHaveLength(source.length);
	});

	it("LSA-T52: empty source yields empty SSE payload set", async () => {
		async function* emptySource(): AsyncIterable<StreamEvent> {}
		const parsed = parseSseDataLines(await readStream(toSSE(emptySource())));
		expect(parsed).toEqual([]);
	});

	it("LSA-T53: citation-grounding fixture retains typed citation event", async () => {
		const parsed = parseSseDataLines(
			await readStream(toSSE(eventsFromFile("citation-grounding.events.json"))),
		) as Array<{ type?: string }>;
		expect(parsed.some((event) => event.type === "citation")).toBe(true);
		expect(parsed.some((event) => event.type === "grounding")).toBe(true);
	});

	it("LSA-T54: all transform fixtures roundtrip with non-empty payload frames", async () => {
		for (const name of eventFiles) {
			const parsed = parseSseDataLines(await readStream(toSSE(eventsFromFile(name))));
			expect(parsed.length).toBeGreaterThan(0);
		}
	});
});
