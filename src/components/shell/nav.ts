// One source for the sidebar, breadcrumbs, bottom nav and placeholder pages.
// `path` is the segment under /w/$slug ("" is the workspace home).
export type NavItem = { path: string; label: string; icon: string };

export const MAIN_NAV: NavItem[] = [
	{ path: "", label: "Home", icon: "icon-[solar--home-2-linear]" },
	{ path: "inbox", label: "Inbox", icon: "icon-[solar--inbox-linear]" },
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
