/**
 * Loaders re-run when you enter a page, not when you stay on it and only the URL's
 * search changes (opening the task drawer, switching a tab). A filter change still
 * reloads, because it changes the loader deps and so counts as entering.
 */
export const reloadOnEnter = ({
	cause,
}: {
	cause: "preload" | "enter" | "stay";
}) => cause !== "stay";
