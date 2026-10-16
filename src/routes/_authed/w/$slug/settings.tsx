import { useSuspenseQuery } from "@apollo/client/react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Fragment } from "react";
import { z } from "zod";
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
import { SETTINGS } from "#/graphql/operations";
import { reloadOnEnter } from "#/lib/routing";
import { cn } from "#/lib/utils";

// Ported from the reference settings page; Billing is omitted (Zadaci is free) and
// Password became Passkeys (Google sign-in has no password).
const SECTIONS = [
	"workspace",
	"appearance",
	"language",
	"datetime",
	"members",
	"teams",
	"projects",
	"permissions",
	"notif-email",
	"notif-push",
	"notif-mentions",
	"notif-assign",
	"profile",
	"preferences",
	"shortcuts",
	"passkeys",
	"sessions",
	"2fa",
] as const;
type Section = (typeof SECTIONS)[number];

const SET_NAV: [string, [Section, string, string][]][] = [
	[
		"General",
		[
			["workspace", "Workspace", "icon-[solar--buildings-2-linear]"],
			["appearance", "Appearance", "icon-[solar--pallete-2-linear]"],
			["language", "Language", "icon-[hugeicons--translate]"],
			["datetime", "Date & time", "icon-[solar--clock-circle-linear]"],
		],
	],
	[
		"Workspace",
		[
			["members", "Members", "icon-[solar--users-group-rounded-linear]"],
			["teams", "Teams", "icon-[solar--users-group-two-rounded-linear]"],
			["projects", "Projects", "icon-[solar--folder-with-files-linear]"],
			["permissions", "Permissions", "icon-[solar--shield-linear]"],
		],
	],
	[
		"Notifications",
		[
			["notif-email", "Email", "icon-[solar--letter-linear]"],
			["notif-push", "Push", "icon-[solar--smartphone-linear]"],
			["notif-mentions", "Mentions", "icon-[hugeicons--at]"],
			["notif-assign", "Task assignments", "icon-[solar--user-check-linear]"],
		],
	],
	[
		"Personal",
		[
			["profile", "Profile", "icon-[solar--user-linear]"],
			["preferences", "Preferences", "icon-[solar--tuning-2-linear]"],
			["shortcuts", "Keyboard shortcuts", "icon-[solar--keyboard-linear]"],
		],
	],
	[
		"Security",
		[
			["passkeys", "Passkeys", "icon-[solar--key-minimalistic-linear]"],
			["sessions", "Sessions", "icon-[solar--devices-linear]"],
			["2fa", "Two-factor authentication", "icon-[solar--shield-check-linear]"],
		],
	],
];

export const Route = createFileRoute("/_authed/w/$slug/settings")({
	validateSearch: z.object({ sec: z.enum(SECTIONS).optional() }),
	shouldReload: reloadOnEnter,
	loader: async ({ context, params }) => {
		const { data } = await context.apolloClient.query({
			query: SETTINGS,
			variables: { slug: params.slug },
		});
		if (!data?.workspace) throw notFound();
	},
	head: () => ({ meta: [{ title: "Settings - Zadaci" }] }),
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
					{sec === "shortcuts" && <ShortcutsSection title={title} />}
					{sec === "passkeys" && <PasskeysSection title={title} />}
					{sec === "sessions" && <SessionsSection title={title} />}
					{sec === "2fa" && <TwoFactorSection title={title} />}
				</div>
			</div>
		</div>
	);
}
