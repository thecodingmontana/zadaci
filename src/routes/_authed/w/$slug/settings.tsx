import { useSuspenseQuery } from "@apollo/client/react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Fragment } from "react";
import { z } from "zod";
import { AiSection } from "#/components/settings/ai-section";
import {
	BookmarksSection,
	CollectionsSection,
	NotesSection,
} from "#/components/settings/content-sections";
import {
	AppearanceSection,
	DateTimeSection,
	LanguageSection,
	WorkspaceSection,
} from "#/components/settings/general";
import {
	NotificationsSection,
	PreferencesSection,
	ProfileSection,
	ShortcutsSection,
} from "#/components/settings/personal";
import {
	PasskeysSection,
	SessionsSection,
	TwoFactorSection,
} from "#/components/settings/security";
import {
	MembersSection,
	PermissionsSection,
	ProjectsSection,
	TeamsSection,
} from "#/components/settings/workspace-group";
import {
	SETTINGS_SECTIONS,
	type SettingsSection,
} from "#/components/shell/nav";
import { SettingsSkeleton } from "#/components/shell/page-skeletons";
import { SETTINGS } from "#/graphql/operations";
import { reloadOnEnter } from "#/lib/routing";
import { wsTitle } from "#/lib/seo";
import { cn } from "#/lib/utils";

// Ported from the reference settings page; Billing is omitted (Zadaci is free) and
// Password became Passkeys (Google sign-in has no password).
// the sections live in nav.ts, shared with the command menu
const SECTIONS = SETTINGS_SECTIONS.map((s) => s.sec) as [
	SettingsSection,
	...SettingsSection[],
];
type Section = SettingsSection;

const SET_NAV: [string, [Section, string, string][]][] = [
	...new Set(SETTINGS_SECTIONS.map((s) => s.group)),
].map((group) => [
	group,
	SETTINGS_SECTIONS.filter((s) => s.group === group).map(
		(s) => [s.sec, s.label, s.icon] as [Section, string, string],
	),
]);

export const Route = createFileRoute("/_authed/w/$slug/settings")({
	validateSearch: z.object({
		sec: z.enum(SECTIONS).optional(),
		// back from connecting GitHub (github-connect.server.ts)
		github: z.string().max(20).optional(),
	}),
	shouldReload: reloadOnEnter,
	loader: async ({ context, params }) => {
		const { data } = await context.apolloClient.query({
			query: SETTINGS,
			variables: { slug: params.slug },
		});
		if (!data?.workspace) throw notFound();
	},
	head: ({ matches }) => ({ meta: [{ title: wsTitle(matches, "Settings") }] }),
	pendingComponent: SettingsSkeleton,
	component: Settings,
});

function Settings() {
	const { slug } = Route.useParams();
	const { sec = "appearance" } = Route.useSearch();
	const { data } = useSuspenseQuery(SETTINGS, { variables: { slug } });
	const workspace = data.workspace;
	if (!workspace) return null;
	const props = { slug, me: data.me, workspace };
	const title =
		SET_NAV.flatMap(([, items]) => items).find(([k]) => k === sec)?.[1] ??
		"Appearance";

	return (
		<div className="set">
			<nav className="set-nav" aria-label="Settings">
				{SET_NAV.map(([group, items]) => (
					<Fragment key={group}>
						<div className="gh">{group}</div>
						{items.map(([k, name, icon]) => (
							<Link
								key={k}
								to="/w/$slug/settings"
								params={{ slug }}
								search={{ sec: k }}
								className={cn("sitem", sec === k && "on")}
								aria-current={sec === k ? "page" : undefined}
							>
								<span
									className={cn(icon, "size-[15px] shrink-0")}
									aria-hidden="true"
								/>
								<span className="trunc">{name}</span>
							</Link>
						))}
					</Fragment>
				))}
			</nav>
			<div className="set-body">
				<div className="set-in">
					{sec === "workspace" && <WorkspaceSection {...props} title={title} />}
					{sec === "appearance" && <AppearanceSection title={title} />}
					{sec === "language" && <LanguageSection {...props} title={title} />}
					{sec === "datetime" && <DateTimeSection {...props} title={title} />}
					{sec === "members" && <MembersSection {...props} title={title} />}
					{sec === "teams" && <TeamsSection {...props} title={title} />}
					{sec === "projects" && <ProjectsSection {...props} title={title} />}
					{sec === "notes" && <NotesSection {...props} title={title} />}
					{sec === "bookmarks" && <BookmarksSection {...props} title={title} />}
					{sec === "collections" && (
						<CollectionsSection {...props} title={title} />
					)}
					{sec === "permissions" && (
						<PermissionsSection {...props} title={title} />
					)}
					{sec.startsWith("notif-") && (
						<NotificationsSection {...props} title={title} sec={sec} />
					)}
					{sec === "profile" && <ProfileSection {...props} title={title} />}
					{sec === "preferences" && (
						<PreferencesSection {...props} title={title} />
					)}
					{sec === "ai" && <AiSection title={title} />}
					{sec === "shortcuts" && <ShortcutsSection title={title} />}
					{sec === "passkeys" && <PasskeysSection title={title} />}
					{sec === "sessions" && <SessionsSection title={title} />}
					{sec === "2fa" && <TwoFactorSection title={title} />}
				</div>
			</div>
		</div>
	);
}
