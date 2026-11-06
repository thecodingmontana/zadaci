const KEY = "zadaci.next";

// Only same-site relative paths, so this can't become an open redirect. Tabs, newlines and
// backslashes are refused: browsers drop or flip them, so "/\t/evil.com" would mean //evil.com.
export function safePath(path: unknown): string | undefined {
	return typeof path === "string" &&
		path.startsWith("/") &&
		!/[\t\r\n\\]/.test(path) &&
		new URL(path, "http://x").host === "x"
		? path
		: undefined;
}

/** Served by the server, not a page in the app (an AI agent's sign-in approval): load it fully. */
export const isServerPath = (path: string) => path.startsWith("/api/");

/** Goes to the remembered page after signing in (see takeNext). */
export function goNext(navigate: (opts: { href: string }) => unknown) {
	const to = takeNext();
	if (isServerPath(to)) window.location.assign(to);
	else void navigate({ href: to });
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
