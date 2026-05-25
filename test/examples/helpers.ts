export function fakeStreamingFetch(
	sse: string,
	init: { ok?: boolean; status?: number; body?: string } = {},
): typeof fetch {
	return (async (_input: RequestInfo | URL, _init?: RequestInit) =>
		new Response(init.body ?? sse, {
			status: init.status ?? (init.ok === false ? 500 : 200),
			headers: { "Content-Type": "text/event-stream" },
		})) as typeof fetch;
}

export async function readResponseText(response: Response): Promise<string> {
	return response.text();
}

export async function withEnv<T>(
	env: Record<string, string | undefined>,
	run: () => T | Promise<T>,
): Promise<T> {
	const previous = new Map<string, string | undefined>();
	for (const key of Object.keys(env)) {
		previous.set(key, process.env[key]);
		const value = env[key];
		if (value === undefined) {
			delete process.env[key];
		} else {
			process.env[key] = value;
		}
	}
	try {
		return await run();
	} finally {
		for (const [key, value] of previous) {
			if (value === undefined) {
				delete process.env[key];
			} else {
				process.env[key] = value;
			}
		}
	}
}

export function parseUnifiedSSE(text: string): unknown[] {
	const events: unknown[] = [];
	for (const frame of text.split(/\n\n/u)) {
		for (const line of frame.split(/\r?\n/u)) {
			if (!line.startsWith("data:")) continue;
			events.push(JSON.parse(line.slice(5).trim()) as unknown);
		}
	}
	return events;
}
