import { AsyncLocalStorage } from "node:async_hooks";

// Marks work the assistant does, so the activity log can say "via assistant" without threading
// a flag through every resolver.
const scope = new AsyncLocalStorage<true>();

export const asAssistant = <T>(work: () => Promise<T>) => scope.run(true, work);

/** "assistant" while running inside asAssistant(), otherwise null. */
export const viaAssistant = () => (scope.getStore() ? "assistant" : null);
