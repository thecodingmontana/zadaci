import { useSyncExternalStore } from "react";

// Per-device appearance, applied to <html> before first paint (see APPEARANCE_SCRIPT).
export type Appearance = {
	theme: "light" | "dark" | "system";
	accent: string;
	side: "comfortable" | "compact";
	density: "comfortable" | "compact";
	motion: "system" | "reduce";
};

const KEY = "zadaci.appearance";
const DEFAULTS: Appearance = {
	theme: "system",
	accent: "orange",
	side: "comfortable",
	density: "comfortable",
	motion: "system",
};

/** Inline script for <head>: same logic as apply(), runs before React so there's no theme flash. */
export const APPEARANCE_SCRIPT = `(function(){try{var a=JSON.parse(localStorage.getItem("${KEY}")||"{}");var r=document.documentElement;var t=a.theme||"system";var d=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);r.classList.toggle("dark",d);r.style.colorScheme=d?"dark":"light";if(a.accent&&a.accent!=="orange")r.dataset.accent=a.accent;if(a.side==="compact")r.dataset.side="compact";if(a.density==="compact")r.dataset.density="compact";if(a.motion==="reduce")r.dataset.motion="reduce";}catch(e){}})();`;

let current: Appearance = DEFAULTS;
const listeners = new Set<() => void>();

function read(): Appearance {
	try {
		return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
	} catch {
		return DEFAULTS;
	}
}

function setData(el: HTMLElement, key: string, value: string | undefined) {
	if (value) el.dataset[key] = value;
	else delete el.dataset[key];
}

function apply(a: Appearance) {
	const root = document.documentElement;
	const dark =
		a.theme === "dark" ||
		(a.theme === "system" &&
			matchMedia("(prefers-color-scheme: dark)").matches);
	// Suppress every colour transition during the swap so the theme change doesn't smear.
	const style = document.createElement("style");
	style.textContent = "*,*::before,*::after{transition:none!important}";
	document.head.appendChild(style);
	root.classList.toggle("dark", dark);
	root.style.colorScheme = dark ? "dark" : "light";
	setData(root, "accent", a.accent === "orange" ? undefined : a.accent);
	setData(root, "side", a.side === "compact" ? "compact" : undefined);
	setData(root, "density", a.density === "compact" ? "compact" : undefined);
	setData(root, "motion", a.motion === "reduce" ? "reduce" : undefined);
	getComputedStyle(root).opacity; // force a style flush before restoring transitions
	requestAnimationFrame(() => style.remove());
}

let started = false;
function start() {
	if (started || typeof window === "undefined") return;
	started = true;
	current = read();
	matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
		if (current.theme === "system") apply(current);
	});
}

export function setAppearance(patch: Partial<Appearance>) {
	start();
	current = { ...current, ...patch };
	try {
		localStorage.setItem(KEY, JSON.stringify(current));
	} catch {}
	apply(current);
	for (const listener of listeners) listener();
}

export function useAppearance(): Appearance {
	return useSyncExternalStore(
		(listener) => {
			start();
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		() => {
			start();
			return current;
		},
		() => DEFAULTS,
	);
}

/** Resolved light/dark for "Switch to dark mode" style commands. */
export const isDark = () =>
	typeof document !== "undefined" &&
	document.documentElement.classList.contains("dark");
