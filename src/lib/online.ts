import { useSyncExternalStore } from "react";

// Who's online in the workspace: the member ids sharing presence on its Realtime topic (set by
// LiveUpdates). Any component reads it with useOnline().

let online: ReadonlySet<string> = new Set();
const listeners = new Set<() => void>();
const NOBODY: ReadonlySet<string> = new Set();

export function setOnline(memberIds: string[]) {
	online = new Set(memberIds);
	for (const l of listeners) l();
}

export const useOnline = () =>
	useSyncExternalStore(
		(changed) => {
			listeners.add(changed);
			return () => listeners.delete(changed);
		},
		() => online,
		() => NOBODY,
	);
