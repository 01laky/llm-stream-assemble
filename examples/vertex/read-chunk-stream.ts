/**
 * Zero-dep helpers to split Vertex raw HTTP streams into JSON payload strings.
 * Examples/tests only — not part of the library core.
 */

export async function* readVertexJsonlStrings(
	body: ReadableStream<Uint8Array>,
): AsyncGenerator<string> {
	const reader = body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			buffer += decoder.decode(value, { stream: true });
			let newlineIndex = buffer.indexOf("\n");
			while (newlineIndex !== -1) {
				const line = buffer.slice(0, newlineIndex).trim().replace(/,\s*$/, "");
				buffer = buffer.slice(newlineIndex + 1);
				if (line.length > 0 && line !== "[" && line !== "]") {
					yield line;
				}
				newlineIndex = buffer.indexOf("\n");
			}
		}
		buffer += decoder.decode();
		const tail = buffer.trim().replace(/,\s*$/, "");
		if (tail.length > 0 && tail !== "[" && tail !== "]") {
			yield tail;
		}
	} finally {
		reader.releaseLock();
	}
}

export async function* readVertexChunkStrings(
	body: ReadableStream<Uint8Array>,
): AsyncGenerator<string> {
	const reader = body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			buffer += decoder.decode(value, { stream: true });
			const extracted = extractVertexJsonObjects(buffer);
			buffer = extracted.remainder;
			for (const object of extracted.objects) {
				yield object;
			}
		}
		buffer += decoder.decode();
		const extracted = extractVertexJsonObjects(buffer);
		for (const object of extracted.objects) {
			yield object;
		}
		const tail = extracted.remainder.trim().replace(/,\s*$/, "");
		if (tail.length > 0 && tail !== "[" && tail !== "]") {
			yield tail;
		}
	} finally {
		reader.releaseLock();
	}
}

export async function collectVertexChunkStrings(
	body: ReadableStream<Uint8Array>,
): Promise<string[]> {
	const out: string[] = [];
	for await (const chunk of readVertexChunkStrings(body)) {
		out.push(chunk);
	}
	return out;
}

export function extractVertexJsonObjects(buffer: string): { objects: string[]; remainder: string } {
	const objects: string[] = [];
	let rest = buffer;
	while (rest.length > 0) {
		rest = rest.trimStart();
		if (rest.startsWith("[") || rest.startsWith("]") || rest.startsWith(",")) {
			rest = rest.slice(1);
			continue;
		}
		if (!rest.startsWith("{")) break;
		const end = findMatchingBrace(rest, 0);
		if (end === -1) break;
		objects.push(rest.slice(0, end));
		rest = rest.slice(end);
	}
	return { objects, remainder: rest };
}

function findMatchingBrace(input: string, start: number): number {
	let depth = 0;
	let inString = false;
	let escape = false;

	for (let i = start; i < input.length; i += 1) {
		const ch = input[i];
		if (inString) {
			if (escape) {
				escape = false;
				continue;
			}
			if (ch === "\\") {
				escape = true;
				continue;
			}
			if (ch === '"') inString = false;
			continue;
		}
		if (ch === '"') {
			inString = true;
			continue;
		}
		if (ch === "{") depth += 1;
		if (ch === "}") {
			depth -= 1;
			if (depth === 0) return i + 1;
		}
	}
	return -1;
}

/** Split buffered text on newlines; yields complete lines via generator wrapper. */
export async function* readVertexJsonlStringsFromText(text: string): AsyncGenerator<string> {
	for (const line of text.split("\n")) {
		const trimmed = line.trim().replace(/,\s*$/, "");
		if (trimmed.length > 0 && trimmed !== "[" && trimmed !== "]") {
			yield trimmed;
		}
	}
}
