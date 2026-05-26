export const OPENAI_COMPATIBLE_PROVIDERS = [
	"generic",
	"openrouter",
	"groq",
	"deepseek",
	"mistral",
	"ollama",
	"lmstudio",
	"together",
	"fireworks",
	"perplexity",
	"xai",
	"azure",
	"cloudflare",
] as const;

export type OpenAICompatibleProvider = (typeof OPENAI_COMPATIBLE_PROVIDERS)[number];

export type HostCompatiblePreset = Exclude<OpenAICompatibleProvider, "generic">;

export const HOST_COMPATIBLE_PRESETS = OPENAI_COMPATIBLE_PROVIDERS.filter(
	(p): p is HostCompatiblePreset => p !== "generic",
);

/** Presets with strict defaults (`allowMissingMetadata: false`, `looseErrorShape: false`). */
export const STRICT_COMPATIBLE_PRESETS = [
	"azure",
] as const satisfies readonly OpenAICompatibleProvider[];

export function isStrictCompatiblePreset(provider: OpenAICompatibleProvider): boolean {
	return (STRICT_COMPATIBLE_PRESETS as readonly string[]).includes(provider);
}

export const LOOSE_HOST_PRESETS = HOST_COMPATIBLE_PRESETS.filter(
	(p) => !isStrictCompatiblePreset(p),
);

export type PresetOverrides = Partial<{
	reasoningFieldAliases: string[];
	looseErrorShape: boolean;
	allowMissingMetadata: boolean;
	useChoicePositionFallback: boolean;
}>;

export const DEFAULT_PRESET = {
	looseErrorShape: true,
	allowMissingMetadata: true,
	useChoicePositionFallback: true,
	reasoningFieldAliases: ["thinking", "thinking_content"],
} as const satisfies PresetOverrides;

export const PRESET_OVERRIDES: Partial<Record<OpenAICompatibleProvider, PresetOverrides>> = {
	deepseek: { reasoningFieldAliases: ["reasoning_content", "reasoning", "thinking"] },
	openrouter: { reasoningFieldAliases: ["reasoning"] },
	together: { reasoningFieldAliases: ["reasoning", "reasoning_delta"] },
	azure: {
		looseErrorShape: false,
		allowMissingMetadata: false,
		useChoicePositionFallback: true,
		reasoningFieldAliases: [],
	},
};

export const PRESET_OVERRIDE_KEYS = Object.keys(PRESET_OVERRIDES) as HostCompatiblePreset[];

export function hasPresetOverride(provider: OpenAICompatibleProvider): boolean {
	return provider in PRESET_OVERRIDES;
}

export function providerPreset(provider: OpenAICompatibleProvider): PresetOverrides {
	return {
		...DEFAULT_PRESET,
		...PRESET_OVERRIDES[provider],
	};
}
