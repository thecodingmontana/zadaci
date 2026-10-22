import { useRouterState } from "@tanstack/react-router";
import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useState,
} from "react";

// Ported shell state: desktop collapse (remembered in a cookie so SSR renders it right) and the mobile drawer.
type ShellState = {
	collapsed: boolean;
	toggleSide: () => void;
	mnav: boolean;
	setMnav: (open: boolean) => void;
};

const ShellContext = createContext<ShellState | null>(null);

export function useShell() {
	const ctx = useContext(ShellContext);
	if (!ctx) throw new Error("useShell must be used inside ShellProvider");
	return ctx;
}

export function ShellProvider({
	defaultCollapsed,
	children,
}: {
	defaultCollapsed: boolean;
	children: ReactNode;
}) {
	const [collapsed, setCollapsed] = useState(defaultCollapsed);
	const [mnav, setMnav] = useState(false);
	const href = useRouterState({ select: (s) => s.location.href });

	// The drawer closes after navigating, like the reference app (a Settings section or a
	// task opening only changes the search part, so that counts too).
	// biome-ignore lint/correctness/useExhaustiveDependencies: run on route change only
	useEffect(() => setMnav(false), [href]);

	// ...and after any link or menu action in it, even one that stays on this page or opens a
	// dialog. Toggles (expand a section) are plain buttons, so they keep it open.
	useEffect(() => {
		if (!mnav) return;
		const close = (e: MouseEvent) => {
			const el = e.target as Element | null;
			if (
				el?.closest('[role="menuitem"], [role="menuitemradio"]') ||
				el?.closest(".side")?.contains(el.closest("a[href]"))
			)
				setMnav(false);
		};
		document.addEventListener("click", close);
		return () => document.removeEventListener("click", close);
	}, [mnav]);

	const toggleSide = () => {
		// On phones the sidebar is a drawer; on desktop it collapses to icons.
		if (window.matchMedia("(max-width: 900px)").matches)
			return setMnav((open) => !open);
		setCollapsed((value) => {
			const next = !value;
			// biome-ignore lint/suspicious/noDocumentCookie: tiny preference cookie read during SSR
			document.cookie = `sidebar_state=${!next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
			return next;
		});
	};

	return (
		<ShellContext.Provider value={{ collapsed, toggleSide, mnav, setMnav }}>
			{children}
		</ShellContext.Provider>
	);
}
