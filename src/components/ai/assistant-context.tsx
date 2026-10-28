import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useState,
} from "react";

// Whether Zad's panel is open, shared by the top bar, the command menu and the workspace layout.
// Kept apart from the panel itself, so pages don't load the whole chat until it's opened.

type Ctx = {
	open: boolean;
	setOpen: (open: boolean) => void;
	toggle: () => void;
};

const AssistantContext = createContext<Ctx | null>(null);

// a closed panel when there's no provider (a hot reload briefly makes a new context), never a crash
const CLOSED: Ctx = { open: false, setOpen: () => {}, toggle: () => {} };

export function useAssistant() {
	return useContext(AssistantContext) ?? CLOSED;
}

const KEY = "zadaci-assistant-open";

export function AssistantProvider({ children }: { children: ReactNode }) {
	const [open, setOpenState] = useState(false);
	// reopens where you left it, after the first render so SSR and the browser agree
	useEffect(() => {
		try {
			if (localStorage.getItem(KEY) === "1") setOpenState(true);
		} catch {}
	}, []);
	const setOpen = (next: boolean) => {
		setOpenState(next);
		try {
			localStorage.setItem(KEY, next ? "1" : "0");
		} catch {}
	};
	return (
		<AssistantContext.Provider
			value={{ open, setOpen, toggle: () => setOpen(!open) }}
		>
			{children}
		</AssistantContext.Provider>
	);
}
