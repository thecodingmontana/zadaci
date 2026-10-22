/** Sends a crash from the browser to /api/client-error, so it shows up in the server logs. */
export function reportError(error: unknown) {
	const err = error instanceof Error ? error : new Error(String(error));
	try {
		navigator.sendBeacon(
			"/api/client-error",
			JSON.stringify({
				message: err.message,
				stack: err.stack,
				path: location.pathname,
			}),
		);
	} catch {
		// logging must never break the error page
	}
}
