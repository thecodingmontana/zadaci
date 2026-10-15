import { WS_SETTINGS_DEFAULTS } from "./preferences";

// Role-based access: one table of rules shared by the GraphQL resolvers (enforcement),
// the UI (what to show) and the "Roles & permissions" tables. Roles follow the reference
// app: Owner, Admin (stored as "moderator"), Member and Guest.

export const ROLES = ["owner", "moderator", "member", "guest"] as const;
export type Role = (typeof ROLES)[number];

/** Roles that manage the workspace. */
export const ADMIN_ROLES: readonly Role[] = ["owner", "moderator"];

type Settings = { permCreate: boolean; permGuests: boolean };
type Rule = (role: string, settings: Settings) => boolean;

const admin: Rule = (role) => (ADMIN_ROLES as readonly string[]).includes(role);
const notGuest: Rule = (role) => role !== "guest";

export const PERMISSIONS = {
	viewAllProjects: { label: "See every project", allow: notGuest },
	comment: { label: "Comment on tasks", allow: () => true },
	editTasks: { label: "Create and edit tasks", allow: notGuest },
	editProjects: {
		label: "Rename, archive and reorder projects",
		allow: notGuest,
	},
	createProjects: {
		label: "Create projects",
		allow: (role, s) => admin(role, s) || (role === "member" && s.permCreate),
	},
	deleteProjects: { label: "Delete projects", allow: admin },
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

/** Whether `role` may do `permission`, given the workspace's permission toggles. */
export function can(
	role: string | null | undefined,
	permission: Permission,
	settings?: Partial<Settings> | null,
) {
	if (!role) return false;
	return PERMISSIONS[permission].allow(role, {
		...WS_SETTINGS_DEFAULTS,
		...settings,
	});
}
