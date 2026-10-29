import { useSyncExternalStore } from "react";

// The chat panel's target: a project's or a task's own chat, opened over whatever page you're on
// (like Zad's panel). openChatDock() from anywhere; the workspace layout shows it.

export type ChatDockTarget = {
	kind: "project" | "task";
	id: string;
	/** its name, for the panel's header (and the chat's name if it's started) */
	title: string;
};

let target: ChatDockTarget | null = null;
const listeners = new Set<() => void>();
const set = (next: ChatDockTarget | null) => {
	target = next;
	for (const l of listeners) l();
};

export const openChatDock = (next: ChatDockTarget) => set(next);
export const closeChatDock = () => set(null);

export const useChatDock = () =>
	useSyncExternalStore(
		(changed) => {
			listeners.add(changed);
			return () => listeners.delete(changed);
		},
		() => target,
		() => null,
	);
