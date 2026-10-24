import { createAnthropicChat } from "@tanstack/ai-anthropic";
import { createGeminiChat } from "@tanstack/ai-gemini";
import { createOpenaiChat } from "@tanstack/ai-openai";
import { createOpenRouterText } from "@tanstack/ai-openrouter";
import { SITE_URL } from "#/lib/seo";

// Every model choice for the assistant goes through this file. The key is read here, on the
// server only (".server" files can't be imported by browser code).

/** OpenRouter's Free Models Router: picks a free model that supports what the request needs. */
export const FREE_ROUTER = "openrouter/free";

export const aiKey = () => process.env.OPENROUTER_API_KEY?.trim() || null;

/** A model pinned with AI_MODEL turns rotation off. */
export const pinnedModel = () => process.env.AI_MODEL?.trim() || null;

type ModelId = Parameters<typeof createOpenRouterText>[0];

/**
 * A chat adapter for one model id. The adapter types its model against a fixed list that
 * doesn't include every free model (or openrouter/free), so the id is passed through as-is.
 */
export function adapterFor(
	model: string,
	fallbacks: string[] = [],
	// a person's own key can be passed here later (bring your own key)
	key = aiKey(),
) {
	if (!key)
		throw new Error(
			"The assistant isn't set up: OPENROUTER_API_KEY is missing",
		);
	return createOpenRouterText(model as ModelId, key, {
		httpReferer: (process.env.APP_URL || SITE_URL).replace(/\/$/, ""),
		appTitle: "Zadaci",
		// OpenRouter's own fallback list: it tries these when the first model fails
		...(fallbacks.length && {
			modelOptions: { models: fallbacks as ModelId[] },
		}),
	});
}

/**
 * A chat adapter for a person's own Claude, ChatGPT or Gemini key. The model ids come from our
 * own list (providers.ts), so they're passed through as each adapter's model type.
 */
export function ownAdapter(
	provider: "anthropic" | "openai" | "gemini",
	model: string,
	key: string,
) {
	if (provider === "anthropic")
		return createAnthropicChat(
			model as Parameters<typeof createAnthropicChat>[0],
			key,
		);
	if (provider === "openai")
		return createOpenaiChat(
			model as Parameters<typeof createOpenaiChat>[0],
			key,
		);
	return createGeminiChat(model as Parameters<typeof createGeminiChat>[0], key);
}
