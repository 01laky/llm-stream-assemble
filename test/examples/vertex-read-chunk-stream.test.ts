import { describe, expect, it } from "vitest";
import {
	buildVertexGenerateUrl,
	buildVertexStreamUrl,
} from "../../examples/vertex/build-vertex-url";
import {
	collectVertexChunkStrings,
	extractVertexJsonObjects,
	readVertexJsonlStringsFromText,
} from "../../examples/vertex/read-chunk-stream";

describe("vertex example helpers", () => {
	it("LSA-GV100: readVertexJsonlStringsFromText yields one object per line", async () => {
		const lines: string[] = [];
		for await (const line of readVertexJsonlStringsFromText('{"a":1}\n{"b":2}\n')) {
			lines.push(line);
		}
		expect(lines).toEqual(['{"a":1}', '{"b":2}']);
	});

	it("LSA-GV101: extractVertexJsonObjects parses incremental array chunk", () => {
		const input = '[{"responseId":"r1","candidates":[]},';
		const { objects, remainder } = extractVertexJsonObjects(input);
		expect(objects).toHaveLength(1);
		expect(objects[0]).toContain('"responseId":"r1"');
		expect(remainder.trim()).toBe("");
	});

	it("LSA-GV102: collectVertexChunkStrings reads ndjson stream body", async () => {
		const body = new ReadableStream<Uint8Array>({
			start(c) {
				c.enqueue(new TextEncoder().encode('{"responseId":"s1","candidates":[]}\n'));
				c.close();
			},
		});
		const lines = await collectVertexChunkStrings(body);
		expect(lines).toHaveLength(1);
	});

	it("LSA-GV102b: readVertexChunkStrings parses single JSON object body without trailing newline", async () => {
		const body = new ReadableStream<Uint8Array>({
			start(c) {
				c.enqueue(new TextEncoder().encode('{"responseId":"solo","candidates":[]}'));
				c.close();
			},
		});
		const lines = await collectVertexChunkStrings(body);
		expect(lines).toEqual(['{"responseId":"solo","candidates":[]}']);
	});

	it("LSA-GV102c: readVertexChunkStrings parses incremental JSON array stream", async () => {
		const body = new ReadableStream<Uint8Array>({
			start(c) {
				c.enqueue(
					new TextEncoder().encode(
						'[{"responseId":"a","candidates":[]},{"responseId":"b","candidates":[]}]',
					),
				);
				c.close();
			},
		});
		const lines = await collectVertexChunkStrings(body);
		expect(lines).toHaveLength(2);
		expect(lines[0]).toContain('"responseId":"a"');
		expect(lines[1]).toContain('"responseId":"b"');
	});

	it("LSA-GV103: buildVertexStreamUrl publisher model path", () => {
		const url = buildVertexStreamUrl({
			projectId: "proj",
			location: "us-central1",
			model: "gemini-2.5-flash",
		});
		expect(url).toContain("publishers/google/models/gemini-2.5-flash:streamGenerateContent");
	});

	it("LSA-GV104: formatVertexRpcError via vertex-gemini example", async () => {
		const { formatVertexRpcError } = await import("../../examples/node-fetch/vertex-gemini");
		expect(formatVertexRpcError({ error: { message: "denied" } })).toBe("denied");
		expect(formatVertexRpcError(null)).toBe("Vertex request failed.");
	});

	it("LSA-GV103b: buildVertexGenerateUrl uses generateContent suffix", () => {
		const url = buildVertexGenerateUrl({
			projectId: "p",
			location: "europe-west1",
			model: "gemini-2.5-flash",
		});
		expect(url).toContain(":generateContent");
	});
});

describe("buildVertexStreamUrl endpoint id", () => {
	it("LSA-GV103c: tuned endpoint id path", () => {
		const url = buildVertexStreamUrl({
			projectId: "proj",
			location: "us-central1",
			model: "ignored",
			endpointId: "1234567890",
		});
		expect(url).toContain("/endpoints/1234567890:streamGenerateContent");
	});
});
