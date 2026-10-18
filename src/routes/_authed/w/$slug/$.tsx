import { createFileRoute, notFound } from "@tanstack/react-router";

// Every section has its own route now. This catch-all only lets links name a section by
// path (sidebar, top bar, settings); anything that lands here is a page that doesn't exist.
export const Route = createFileRoute("/_authed/w/$slug/$")({
	beforeLoad: () => {
		throw notFound();
	},
});
