import { createFileRoute, notFound } from "@tanstack/react-router";
import { ComingSoon } from "#/components/shell/coming-soon";
import { navItem } from "#/components/shell/nav";

// shortcut: one placeholder for every nav page not built yet; real routes replace entries as they land
export const Route = createFileRoute("/_authed/w/$slug/$")({
	beforeLoad: ({ params }) => {
		const section = params._splat?.split("/")[0] ?? "";
		const item = navItem(section);
		if (!item) throw notFound();
		return { item };
	},
	component: Placeholder,
});

function Placeholder() {
	const { item } = Route.useRouteContext();
	return <ComingSoon title={item.label} icon={item.icon} />;
}
