import { WS_SETTINGS_DEFAULTS } from "./preferences";

// Role-based access: one table of rules shared by the GraphQL resolvers (enforcement),
// the UI (what to show) and the "Roles & permissions" tables. Roles follow the reference
// app: Owner, Admin (stored as "moderator"), Member and Guest.

export const ROLES = ["owner", "moderator", "member", "guest"] as const;
export type Role = (typeof ROLES)[number];

/** Roles that manage the workspace. */
export const ADMIN_ROLES: readonly Role[] = ["owner", "moderator"];

type Settings = {
	permCreate: boolean;
	permGuests: boolean;
	/** custom permissions an admin set: which roles may do each one */
	permOverrides?: Record<string, string[]>;
};
type Rule = (role: string, settings: Settings) => boolean;

const admin: Rule = (role) => (ADMIN_ROLES as readonly string[]).includes(role);
const notGuest: Rule = (role) => role !== "guest";

export const PERMISSIONS = {
	viewAllProjects: {
		label: "See and comment on projects shared with the workspace",
		allow: notGuest,
	},
	manageAllProjects: {
		label: "Full access to every project, private ones too",
		allow: admin,
	},
	editProjects: { label: "Reorder projects in the sidebar", allow: notGuest },
	createProjects: {
		label: "Create projects",
		allow: (role, s) => admin(role, s) || (role === "member" && s.permCreate),
	},
	deleteProjects: { label: "Delete projects", allow: admin },
	workspaceContent: {
		label: "Add and edit notes, bookmarks and collections outside projects",
		allow: notGuest,
	},
	manageAllContent: {
		label: "Delete or reshare anyone's notes, bookmarks and collections",
		allow: admin,
	},
	inviteGuests: {
		label: "Invite guests",
		allow: (role, s) => admin(role, s) || (role === "member" && s.permGuests),
	},
	inviteMembers: { label: "Invite members and admins", allow: admin },
	manageRoles: { label: "Manage roles", allow: admin },
	manageTeams: { label: "Manage teams", allow: admin },
	workspaceSettings: { label: "Workspace settings", allow: admin },
	deleteWorkspace: {
		label: "Delete workspace",
		allow: (role) => role === "owner",
	},
} satisfies Record<string, { label: string; allow: Rule }>;

export type Permission = keyof typeof PERMISSIONS;

/**
 * Permissions an admin can't change: the owner's own, and the ones that would let admins
 * lock themselves (or everyone) out of fixing the settings.
 */
export const LOCKED: readonly Permission[] = [
	"deleteWorkspace",
	"workspaceSettings",
	"manageRoles",
];

/** Whether `role` may do `permission`, given the workspace's settings and custom permissions. */
export function can(
	role: string | null | undefined,
	permission: Permission,
	/** the workspace's settings, as stored (an object, or nothing for the defaults) */
	settings?: unknown,
) {
	if (!role) return false;
	const s: Settings = {
		...WS_SETTINGS_DEFAULTS,
		...(settings as Partial<Settings> | null | undefined),
	};
	const custom = s.permOverrides?.[permission];
	// the owner can always do everything their role allows
	if (custom && role !== "owner" && !LOCKED.includes(permission))
		return custom.includes(role);
	return PERMISSIONS[permission].allow(role, s);
}

/** Admins invite anyone; members may invite guests when the workspace allows it. */
export const canInvite = (
	role: string | null | undefined,
	settings?: unknown,
) => can(role, "inviteMembers") || can(role, "inviteGuests", settings);

// ---- project rights (the Share modal) ----

export const PROJECT_RIGHTS = ["view", "comment", "edit", "full"] as const;
export type ProjectRight = (typeof PROJECT_RIGHTS)[number];
export const PROJECT_RIGHT_LABEL: Record<ProjectRight, string> = {
	view: "Can view",
	comment: "Can comment",
	edit: "Can edit",
	full: "Full access",
};

/**
 * What someone may do in one project, or null when they can't see it.
 * `membership` is undefined when they aren't on the project, null when they are
 * with the default for their role, or the right they were given in Share.
 */
export function projectRight(
	role: string | null | undefined,
	project: { access: string; isLead: boolean },
	membership: string | null | undefined,
	settings?: unknown,
): ProjectRight | null {
	if (can(role, "manageAllProjects", settings) || project.isLead) return "full";
	if (membership !== undefined)
		return (PROJECT_RIGHTS as readonly string[]).includes(membership ?? "")
			? (membership as ProjectRight)
			: role === "guest"
				? "comment"
				: "edit";
	if (project.access === "workspace" && can(role, "viewAllProjects", settings))
		return "comment";
	return null;
}

export const hasRight = (right: ProjectRight | null, needed: ProjectRight) =>
	!!right && PROJECT_RIGHTS.indexOf(right) >= PROJECT_RIGHTS.indexOf(needed);

/** What each project right allows inside a project, for the "Project access" table. */
export const PROJECT_ABILITIES: { label: string; needs: ProjectRight }[] = [
	{
		label: "See its tasks, files, notes and bookmark collections",
		needs: "view",
	},
	{ label: "Comment and react on its tasks and notes", needs: "comment" },
	{
		label: "Add and edit its tasks, files, saved views, notes and bookmarks",
		needs: "edit",
	},
	{ label: "Rename, archive and edit the project's details", needs: "edit" },
	{
		label:
			"Share it, change people's access and the lead, move notes and collections in or out, delete anyone's comments",
		needs: "full",
	},
];
