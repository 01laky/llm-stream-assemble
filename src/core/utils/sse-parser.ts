export class SSEParser {
	private lineBuffer = "";
	private dataLines: string[] = [];

	push(chunk: string): string[] {
		const payloads: string[] = [];
		this.lineBuffer += chunk;

		while (true) {
			const lineEnd = this.findLineEnd();
			if (!lineEnd) break;

			const line = this.lineBuffer.slice(0, lineEnd.index);
			this.lineBuffer = this.lineBuffer.slice(lineEnd.nextIndex);
			const payload = this.processLine(line);
			if (payload !== undefined) {
				payloads.push(payload);
			}
		}

		return payloads;
	}

	flush(): string[] {
		const payloads: string[] = [];

		if (this.lineBuffer.length > 0) {
			const payload = this.processLine(this.lineBuffer);
			this.lineBuffer = "";
			if (payload !== undefined) {
				payloads.push(payload);
			}
		}

		const payload = this.dispatch();
		if (payload !== undefined) {
			payloads.push(payload);
		}

		return payloads;
	}

	private findLineEnd(): { index: number; nextIndex: number } | undefined {
		const lf = this.lineBuffer.indexOf("\n");
		const cr = this.lineBuffer.indexOf("\r");

		if (lf === -1 && cr === -1) return undefined;

		if (cr !== -1 && (lf === -1 || cr < lf)) {
			const nextIndex = this.lineBuffer[cr + 1] === "\n" ? cr + 2 : cr + 1;
			return { index: cr, nextIndex };
		}

		return { index: lf, nextIndex: lf + 1 };
	}

	private processLine(line: string): string | undefined {
		if (line === "") {
			return this.dispatch();
		}

		if (line.startsWith(":")) {
			return undefined;
		}

		const colon = line.indexOf(":");
		const field = colon === -1 ? line : line.slice(0, colon);
		let value = colon === -1 ? "" : line.slice(colon + 1);
		if (value.startsWith(" ")) {
			value = value.slice(1);
		}

		if (field === "data") {
			this.dataLines.push(value);
		}

		return undefined;
	}

	private dispatch(): string | undefined {
		if (this.dataLines.length === 0) {
			return undefined;
		}

		const payload = this.dataLines.join("\n");
		this.dataLines = [];
		return payload.length > 0 ? payload : undefined;
	}
}
