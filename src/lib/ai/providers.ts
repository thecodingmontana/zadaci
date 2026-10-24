// The AI companies a person can bring their own key for, shared by the settings screen and the
// server. Names, key formats and models only; never a key.

export type ProviderId = "openrouter" | "anthropic" | "openai" | "gemini";

export type Provider = {
	id: ProviderId;
	label: string;
	/** its logo (Iconify class) */
	icon: string;
	/** where people make a key */
	keysUrl: string;
	/** what a key looks like, to catch a paste into the wrong box before asking the provider */
	keyPattern: RegExp;
	keyExample: string;
	/** models to pick from; the first is the default ("" means rotate free models) */
	models: { id: string; label: string }[];
};

export const PROVIDERS: Provider[] = [
	{
		id: "anthropic",
		icon: "icon-[logos--anthropic-icon]",
		label: "Claude (Anthropic)",
		keysUrl: "https://console.anthropic.com/settings/keys",
		keyPattern: /^sk-ant-[A-Za-z0-9_-]{20,300}$/,
		keyExample: "sk-ant-…",
		models: [
			{ id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5" },
			{ id: "claude-haiku-5-5", label: "Claude Haiku 5.5 (faster, cheaper)" },
			{ id: "claude-opus-5-5", label: "Claude Opus 5.5 (most capable)" },
		],
	},
	{
		id: "openai",
		icon: "icon-[logos--openai-icon]",
		label: "ChatGPT (OpenAI)",
		keysUrl: "https://platform.openai.com/api-keys",
		keyPattern: /^sk-[A-Za-z0-9_-]{20,300}$/,
		keyExample: "sk-…",
		models: [
			{ id: "gpt-5-mini", label: "GPT-5 mini" },
			{ id: "gpt-5.2", label: "GPT-5.2 (most capable)" },
		],
	},
	{
		id: "gemini",
		icon: "icon-[logos--google-gemini-icon]",
		label: "Gemini (Google)",
		keysUrl: "https://aistudio.google.com/apikey",
		keyPattern: /^[A-Za-z0-9_-]{30,100}$/,
		keyExample: "AIza…",
		models: [
			{ id: "gemini-3.5-flash", label: "Gemini 3.5 Flash" },
			{ id: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro (most capable)" },
		],
	},
	{
		id: "openrouter",
		icon: "icon-[logos--openrouter-icon]",
		label: "OpenRouter",
		keysUrl: "https://openrouter.ai/keys",
		keyPattern: /^sk-or-[A-Za-z0-9_-]{20,300}$/,
		keyExample: "sk-or-…",
		models: [{ id: "", label: "Free models (rotates when one is busy)" }],
	},
];

export const providerOf = (id: string) => PROVIDERS.find((p) => p.id === id);

/** A model that provider offers here, or its default. */
export const modelFor = (provider: Provider, model?: string | null) =>
	provider.models.some((m) => m.id === model)
		? (model as string)
		: provider.id === "openrouter" && model
			? model
			: (provider.models[0]?.id ?? "");
