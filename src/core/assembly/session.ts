import type { AssembleOptions, StreamAdapter, StreamEvent } from "../types";
import { processPayload, resolveTerminalFlush } from "./process-payload";
import { EventAssembler } from "../assembler/event-assembler";

export interface AssemblySessionOptions {
	assembler: EventAssembler;
	adapter: StreamAdapter;
	assembleOptions: AssembleOptions;
}

export class AssemblySession {
	private sawTerminalMarker = false;
	private aborted = false;

	constructor(private readonly ctx: AssemblySessionOptions) {}

	get assembler(): EventAssembler {
		return this.ctx.assembler;
	}

	markAborted(): void {
		this.aborted = true;
	}

	isAborted(): boolean {
		return this.aborted || this.ctx.assembleOptions.signal?.aborted === true;
	}

	handlePayload(payload: string): StreamEvent[] {
		if (this.isAborted()) {
			return this.ctx.assembler.flush({ terminalReason: "aborted" });
		}

		const result = processPayload(
			payload,
			this.ctx.assembler,
			this.ctx.adapter,
			this.ctx.assembleOptions,
		);

		if (result.kind === "done-marker") {
			this.sawTerminalMarker = true;
			return [];
		}
		if (result.kind === "recoverable-error") {
			return [result.event];
		}
		return result.events;
	}

	terminalFlush(): StreamEvent[] {
		return resolveTerminalFlush(this.ctx.assembler, {
			sawTerminalMarker: this.sawTerminalMarker,
			aborted: this.isAborted(),
		});
	}

	static create(adapter: StreamAdapter, options: AssembleOptions = {}): AssemblySession {
		return new AssemblySession({
			assembler: new EventAssembler(options),
			adapter,
			assembleOptions: options,
		});
	}
}
