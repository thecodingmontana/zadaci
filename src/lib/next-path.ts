const KEY = "zadaci.next";

// Only same-site relative paths, so this can't become an open redirect.
export function safePath(path: unknown): string | undefined {
	return typeof path === "string" &&
		path.startsWith("/") &&
		!path.startsWith("//") &&
		!path.startsWith("/\\")
		? path
		: undefined;
}

export function rememberNext(path: string | undefined) {
	try {
		if (safePath(path)) sessionStorage.setItem(KEY, path as string);
	} catch {}
}

export function takeNext(): string {
	try {
		const path = safePath(sessionStorage.getItem(KEY));
		sessionStorage.removeItem(KEY);
		return path ?? "/workspace";
	} catch {
		return "/workspace";
	}
}
