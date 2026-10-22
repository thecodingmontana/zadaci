import { useSyncExternalStore } from "react";

// "Install app": the browser offers installation once (beforeinstallprompt); keep that offer
// so the account menu can show it, and drop it once used or installed.
type InstallEvent = Event & { prompt: () => Promise<unknown> };
let offer: InstallEvent | null = null;
const listeners = new Set<() => void>();
const emit = () => {
	for (const l of listeners) l();
};

/** Registers the service worker (push + offline page) and listens for the install offer. */
let started = false;
export function startPwa() {
	if (typeof window === "undefined" || started) return;
	started = true;
	if ("serviceWorker" in navigator)
		navigator.serviceWorker
			.register("/sw.js", { updateViaCache: "none" })
			.catch(() => {});
	addEventListener("beforeinstallprompt", (e) => {
		e.preventDefault();
		offer = e as InstallEvent;
		emit();
	});
	addEventListener("appinstalled", () => {
		offer = null;
		emit();
	});
}

/** The install action while the browser allows it, otherwise null. */
export function useInstall() {
	const current = useSyncExternalStore(
		(l) => {
			listeners.add(l);
			return () => listeners.delete(l);
		},
		() => offer,
		() => null,
	);
	return current
		? async () => {
				await current.prompt();
				offer = null;
				emit();
			}
		: null;
}
