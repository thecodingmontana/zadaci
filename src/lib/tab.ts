// This browser tab's id, sent with each API request so a live update the tab caused itself
// can be told apart from a teammate's (lib/realtime.server, components/shell/live-updates).
export const TAB_ID =
	typeof crypto !== "undefined" && "randomUUID" in crypto
		? crypto.randomUUID()
		: Math.random().toString(36).slice(2);

/** A tab id from a request header, if it looks like one. */
export const tabFrom = (value: string | null | undefined) =>
	value && /^[\w-]{1,64}$/.test(value) ? value : null;
