import type { StreamEvent } from "../../src/core/types";

export interface InvariantProfile {
	name: string;
	allowsLateDeltas?: boolean;
	allowsUsageAfterFinish?: boolean;
	checkLogprobOrder?: boolean;
}

export const INVARIANT_PROFILES: Record<string, InvariantProfile> = {
	openaiChat: { name: "openaiChat", checkLogprobOrder: true },
	openaiResponses: { name: "openaiResponses", allowsLateDeltas: true, checkLogprobOrder: true },
	openaiCompatible: { name: "openaiCompatible", checkLogprobOrder: true },
	anthropic: { name: "anthropic" },
	gemini: { name: "gemini" },
	geminiVertex: { name: "geminiVertex" },
	bedrock: { name: "bedrock" },
	cohere: { name: "cohere", allowsLateDeltas: true },
};

function terminalFinishIndex(events: StreamEvent[]): number {
	return events.findIndex(
		(event) =>
			event.type === "finish" &&
			(event.reason === "stop" || event.reason === "error" || event.reason === "incomplete"),
	);
}

export function assertStreamInvariants(events: StreamEvent[], profile: InvariantProfile): void {
	const hasTextDelta = events.some((event) => event.type === "text.delta");
	const hasTextDone = events.some((event) => event.type === "text.done");
	const hasErrorFinish = events.some(
		(event) => event.type === "finish" && event.reason === "error",
	);
	if (hasTextDelta && !hasTextDone && !hasErrorFinish) {
		throw new Error(`${profile.name}: text.delta without text.done or error finish`);
	}

	const toolStarts = events.filter((event) => event.type === "tool_call.start");
	for (const start of toolStarts) {
		const id = start.id;
		const startIndex = events.indexOf(start);
		const argsIndex = events.findIndex(
			(event, index) =>
				index > startIndex &&
				(event.type === "tool_call.args.delta" || event.type === "tool_call.done") &&
				(id ? event.id === id : true),
		);
		if (argsIndex === -1 && !events.some((event) => event.type === "tool_call.done")) {
			throw new Error(`${profile.name}: tool_call.start without follow-up lifecycle`);
		}
	}

	const terminalReasons = events.filter(
		(event) =>
			event.type === "finish" &&
			(event.reason === "stop" || event.reason === "error" || event.reason === "incomplete"),
	);
	if (terminalReasons.length > 1 && profile.name !== "openaiResponses") {
		const stopCount = terminalReasons.filter((event) => event.reason === "stop").length;
		if (stopCount > 1) {
			throw new Error(`${profile.name}: multiple terminal finish events`);
		}
	}

	const terminalIndex = terminalFinishIndex(events);
	if (terminalIndex !== -1 && !profile.allowsLateDeltas) {
		const late = events
			.slice(terminalIndex + 1)
			.some((event) => event.type === "text.delta" || event.type.startsWith("tool_call."));
		if (late) {
			throw new Error(`${profile.name}: events after terminal finish`);
		}
	}

	if (profile.checkLogprobOrder) {
		const firstTextIndex = events.findIndex((event) => event.type === "text.delta");
		const lastLogprobIndex = events.reduce(
			(last, event, index) => (event.type === "logprob" ? index : last),
			-1,
		);
		if (firstTextIndex !== -1 && lastLogprobIndex !== -1 && lastLogprobIndex > firstTextIndex) {
			throw new Error(`${profile.name}: logprob after first text.delta`);
		}
	}

	if (!profile.allowsUsageAfterFinish && terminalIndex !== -1) {
		const lateUsage = events.slice(terminalIndex + 1).some((event) => event.type === "usage");
		if (lateUsage) {
			throw new Error(`${profile.name}: usage after terminal finish`);
		}
	}
}

const ADAPTER_PROFILE_MAP: Record<string, InvariantProfile> = {
	"openai-chat": INVARIANT_PROFILES.openaiChat,
	"openai-responses": INVARIANT_PROFILES.openaiResponses,
	anthropic: INVARIANT_PROFILES.anthropic,
	gemini: INVARIANT_PROFILES.gemini,
	"gemini-vertex": INVARIANT_PROFILES.geminiVertex,
	cohere: INVARIANT_PROFILES.cohere,
	bedrock: INVARIANT_PROFILES.bedrock,
};

export function profileForAdapterKey(adapterKey: string): InvariantProfile {
	if (adapterKey.startsWith("openai-compatible")) return INVARIANT_PROFILES.openaiCompatible;
	return ADAPTER_PROFILE_MAP[adapterKey] ?? { name: adapterKey };
}
