import { describe, expect, it } from "vitest";
import { createAssemblyTransform } from "../src/core/create-assembly-transform";

async function collectReadable<T>(readable: ReadableStream<T>): Promise<T[]> {
	const reader = readable.getReader();
	const items: T[] = [];
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		items.push(value);
	}
	return items;
}

describe("createAssemblyTransform", () => {
	it("LSA-C46: transforms bytes into StreamEvents", async () => {
		const transform = createAssemblyTransform({
			parseChunk() {
				return [{ kind: "text-delta", text: "hi" }];
			},
		});
		const collected = collectReadable(transform.readable);
		const writer = transform.writable.getWriter();
		await writer.write(new TextEncoder().encode("data: one\n\n"));
		await writer.write(new TextEncoder().encode("data: [DONE]\n\n"));
		await writer.close();

		await expect(collected).resolves.toEqual([
			{ type: "text.delta", text: "hi" },
			{ type: "text.done", text: "hi" },
			{ type: "finish", reason: "stop" },
		]);
	});

	it("LSA-C47: handles many chunks while a consumer reads later", async () => {
		const transform = createAssemblyTransform({
			parseChunk(raw) {
				return [{ kind: "text-delta", text: raw }];
			},
		});
		const collected = collectReadable(transform.readable);
		const writer = transform.writable.getWriter();
		for (let index = 0; index < 25; index += 1) {
			await writer.write(new TextEncoder().encode(`data: ${index}\n\n`));
		}
		await writer.write(new TextEncoder().encode("data: [DONE]\n\n"));
		await writer.close();
		const events = await collected;

		expect(events.at(-2)).toEqual({
			type: "text.done",
			text: Array.from({ length: 25 }, (_, index) => String(index)).join(""),
		});
		expect(events.at(-1)).toEqual({ type: "finish", reason: "stop" });
	});
});
