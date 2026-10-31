// One source for the sidebar, breadcrumbs, bottom nav and placeholder pages.
// `path` is the segment under /w/$slug ("" is the workspace home).
export type NavItem = { path: string; label: string; icon: string };

export const MAIN_NAV: NavItem[] = [
	{ path: "", label: "Home", icon: "icon-[solar--home-2-linear]" },
	{ path: "inbox", label: "Inbox", icon: "icon-[solar--inbox-linear]" },
	{ path: "chat", label: "Chat", icon: "icon-[solar--chat-round-dots-linear]" },
	{
		path: "my-tasks",
		label: "My Tasks",
		icon: "icon-[solar--check-circle-linear]",
	},
	{ path: "favorites", label: "Favorites", icon: "icon-[solar--star-linear]" },
	{
		path: "notifications",
		label: "Notifications",
		icon: "icon-[solar--bell-linear]",
	},
];

export const WORKSPACE_NAV: NavItem[] = [
	{
		path: "overview",
		label: "Overview",
		icon: "icon-[solar--widget-2-linear]",
	},
	{
		path: "projects",
		label: "Projects",
		icon: "icon-[solar--folder-with-files-linear]",
	},
	{
		path: "tasks",
		label: "Tasks",
		icon: "icon-[solar--checklist-minimalistic-linear]",
	},
	{
		path: "bookmarks",
		label: "Bookmarks",
		icon: "icon-[solar--bookmark-linear]",
	},
	{
		path: "calendar",
		label: "Calendar",
		icon: "icon-[solar--calendar-linear]",
	},
	{
		path: "timeline",
		label: "Timeline",
		icon: "icon-[hugeicons--chart-gantt]",
	},
	{
		path: "members",
		label: "Members",
		icon: "icon-[solar--users-group-rounded-linear]",
	},
	{
		path: "activity",
		label: "Activity",
		icon: "icon-[hugeicons--activity-01]",
	},
];

export const ARCHIVE_NAV: NavItem = {
	path: "archive",
	label: "Archive",
	icon: "icon-[solar--archive-linear]",
};
export const SETTINGS_NAV: NavItem = {
	path: "settings",
	label: "Settings",
	icon: "icon-[solar--settings-linear]",
};
export const TEAMS_NAV: NavItem = {
	path: "teams",
	label: "Teams",
	icon: "icon-[solar--users-group-two-rounded-linear]",
};

export const PROJECT_TABS = [
	{ tab: "board", label: "Board", icon: "icon-[hugeicons--kanban]" },
	{ tab: "list", label: "List", icon: "icon-[solar--list-linear]" },
	{ tab: "timeline", label: "Timeline", icon: "icon-[hugeicons--chart-gantt]" },
	{ tab: "files", label: "Files", icon: "icon-[solar--paperclip-linear]" },
] as const;

/** Tabs on the project page (reference PTABS); the sidebar shows the shorter PROJECT_TABS. */
export const PROJECT_PAGE_TABS = [
	{ tab: "overview", label: "Overview", icon: "icon-[solar--widget-2-linear]" },
	{ tab: "board", label: "Board", icon: "icon-[hugeicons--kanban]" },
	{ tab: "list", label: "List", icon: "icon-[solar--list-linear]" },
	{ tab: "table", label: "Table", icon: "icon-[solar--table-linear]" },
	{ tab: "calendar", label: "Calendar", icon: "icon-[solar--calendar-linear]" },
	{ tab: "timeline", label: "Timeline", icon: "icon-[hugeicons--chart-gantt]" },
	{ tab: "files", label: "Files", icon: "icon-[solar--paperclip-linear]" },
	{ tab: "activity", label: "Activity", icon: "icon-[hugeicons--activity-01]" },
] as const;

export const BOTTOM_NAV: NavItem[] = [
	MAIN_NAV[0],
	MAIN_NAV[2],
	WORKSPACE_NAV[1],
	MAIN_NAV[1],
].filter((item): item is NavItem => !!item);

const ALL = [
	...MAIN_NAV,
	...WORKSPACE_NAV,
	ARCHIVE_NAV,
	SETTINGS_NAV,
	TEAMS_NAV,
];
export const navItem = (path: string) => ALL.find((item) => item.path === path);

/**
 * Every Settings section, for the settings page's own menu and the command menu (with words people
 * may search for, like "github" for Sessions). Add a new section here and both pick it up.
 */
export const SETTINGS_SECTIONS = [
	{
		group: "General",
		sec: "workspace",
		label: "Workspace",
		icon: "icon-[solar--buildings-2-linear]",
		keywords: "name logo address delete workspace",
	},
	{
		group: "General",
		sec: "appearance",
		label: "Appearance",
		icon: "icon-[solar--pallete-2-linear]",
		keywords: "theme dark light mode colors",
	},
	{
		group: "General",
		sec: "language",
		label: "Language",
		icon: "icon-[hugeicons--translate]",
		keywords: "locale",
	},
	{
		group: "General",
		sec: "datetime",
		label: "Date & time",
		icon: "icon-[solar--clock-circle-linear]",
		keywords: "time zone week start format",
	},
	{
		group: "Workspace",
		sec: "members",
		label: "Members",
		icon: "icon-[solar--users-group-rounded-linear]",
		keywords: "invite people roles remove",
	},
	{
		group: "Workspace",
		sec: "teams",
		label: "Teams",
		icon: "icon-[solar--users-group-two-rounded-linear]",
		keywords: "groups",
	},
	{
		group: "Workspace",
		sec: "projects",
		label: "Projects",
		icon: "icon-[solar--folder-with-files-linear]",
		keywords: "statuses defaults",
	},
	{
		group: "Workspace",
		sec: "notes",
		label: "Notes",
		icon: "icon-[solar--document-text-linear]",
		keywords: "pages docs",
	},
	{
		group: "Workspace",
		sec: "bookmarks",
		label: "Bookmarks",
		icon: "icon-[solar--bookmark-linear]",
		keywords: "links",
	},
	{
		group: "Workspace",
		sec: "collections",
		label: "Collections",
		icon: "icon-[solar--folder-linear]",
		keywords: "bookmark folders",
	},
	{
		group: "Workspace",
		sec: "permissions",
		label: "Permissions",
		icon: "icon-[solar--shield-linear]",
		keywords: "roles access guests who can",
	},
	{
		group: "Notifications",
		sec: "notif-email",
		label: "Email",
		icon: "icon-[solar--letter-linear]",
		keywords: "digest reminders email",
	},
	{
		group: "Notifications",
		sec: "notif-push",
		label: "Push",
		icon: "icon-[solar--smartphone-linear]",
		keywords: "phone browser devices",
	},
	{
		group: "Notifications",
		sec: "notif-mentions",
		label: "Mentions",
		icon: "icon-[hugeicons--at]",
		keywords: "@ mentions",
	},
	{
		group: "Notifications",
		sec: "notif-assign",
		label: "Task assignments",
		icon: "icon-[solar--user-check-linear]",
		keywords: "assigned",
	},
	{
		group: "Personal",
		sec: "profile",
		label: "Profile",
		icon: "icon-[solar--user-linear]",
		keywords: "name picture avatar your data export download delete account",
	},
	{
		group: "Personal",
		sec: "preferences",
		label: "Preferences",
		icon: "icon-[solar--tuning-2-linear]",
		keywords: "default view start page",
	},
	{
		group: "Personal",
		sec: "ai",
		label: "Zad",
		icon: "icon-[hugeicons--ai-magic]",
		keywords: "assistant ai keys models anthropic openai openrouter",
	},
	{
		group: "Personal",
		sec: "shortcuts",
		label: "Keyboard shortcuts",
		icon: "icon-[solar--keyboard-linear]",
		keywords: "keys hotkeys",
	},
	{
		group: "Security",
		sec: "passkeys",
		label: "Passkeys",
		icon: "icon-[solar--key-minimalistic-linear]",
		keywords: "sign in face touch id security key",
	},
	{
		group: "Security",
		sec: "sessions",
		label: "Sessions",
		icon: "icon-[solar--devices-linear]",
		keywords:
			"devices sign out connected apps github ai agents mcp claude cursor codex disconnect",
	},
	{
		group: "Security",
		sec: "2fa",
		label: "Two-factor authentication",
		icon: "icon-[solar--shield-check-linear]",
		keywords: "2fa totp authenticator recovery codes",
	},
] as const;
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number]["sec"];
