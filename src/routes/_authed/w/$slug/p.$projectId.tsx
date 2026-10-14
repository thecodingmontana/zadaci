import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ComingSoon } from "#/components/shell/coming-soon";
import { PROJECT_TABS } from "#/components/shell/nav";

export const Route = createFileRoute("/_authed/w/$slug/p/$projectId")({
	validateSearch: z.object({
		tab: z.enum(["board", "list", "timeline", "files"]).optional(),
	}),
	component: ProjectPage,
});

// shortcut: placeholder until the board/list/timeline/files views are built
function ProjectPage() {
	const { tab = "board" } = Route.useSearch();
	const current = PROJECT_TABS.find((t) => t.tab === tab) ?? PROJECT_TABS[0];
	return <ComingSoon title={`${current.label} view`} icon={current.icon} />;
}
