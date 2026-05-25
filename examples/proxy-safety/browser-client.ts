export async function readUnifiedSSE(
	response: Response,
	onEvent: (event: unknown) => void,
): Promise<void> {
	if (!response.body) return;
	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });
		buffer = drainFrames(buffer, onEvent);
	}

	buffer += decoder.decode();
	drainFrames(buffer, onEvent);
}

function drainFrames(buffer: string, onEvent: (event: unknown) => void): string {
	let next = buffer;
	while (true) {
		const boundary = next.indexOf("\n\n");
		if (boundary === -1) return next;
		const frame = next.slice(0, boundary);
		next = next.slice(boundary + 2);
		for (const line of frame.split(/\r?\n/u)) {
			if (!line.startsWith("data:")) continue;
			const json = line.slice(5).trimStart();
			if (json.length > 0) onEvent(JSON.parse(json) as unknown);
		}
	}
}
