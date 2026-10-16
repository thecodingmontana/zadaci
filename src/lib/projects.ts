import { TEMPLATES } from "./onboarding";

// Project vocabulary shared by the UI and the server (reference app constants.js).

/** Project health: label and colour (reference PSTAT). */
export const PSTAT = {
	planning: { name: "Planning", c: "var(--q-gray)" },
	active: { name: "In Progress", c: "var(--q-blue)" },
	risk: { name: "At Risk", c: "var(--q-red)" },
	hold: { name: "On Hold", c: "var(--q-amber)" },
	complete: { name: "Completed", c: "var(--q-green)" },
} as const;
export type ProjectStatus = keyof typeof PSTAT;
export const pstat = (status: string) =>
	PSTAT[status as ProjectStatus] ?? PSTAT.planning;

/** Project icons: the reference picker set as [Iconify class, label]. */
export const PROJECT_ICONS = [
	["icon-[solar--global-linear]", "Globe"],
	["icon-[solar--smartphone-linear]", "Phone"],
	["icon-[hugeicons--megaphone-01]", "Megaphone"],
	["icon-[solar--rocket-linear]", "Rocket"],
	["icon-[solar--widget-4-linear]", "Components"],
	["icon-[solar--buildings-2-linear]", "Building"],
	["icon-[solar--widget-linear]", "Grid"],
	["icon-[solar--palette-linear]", "Palette"],
	["icon-[solar--code-linear]", "Code"],
	["icon-[solar--case-linear]", "Briefcase"],
	["icon-[solar--target-linear]", "Target"],
	["icon-[solar--layers-linear]", "Layers"],
	["icon-[solar--bolt-linear]", "Bolt"],
	["icon-[solar--heart-linear]", "Heart"],
	["icon-[solar--folder-linear]", "Folder"],
	["icon-[solar--stars-linear]", "Sparkles"],
] as const;

/**
 * Short project code for task keys: initials of the name ("Website Redesign" → "WR"), else its
 * first letters, made unique against `taken` by adding X (reference makeKey).
 */
export function makeKey(name: string, taken: readonly string[] = []) {
	let key = name
		.split(/\s+/)
		.map((w) => w[0] ?? "")
		.join("")
		.toUpperCase()
		.replace(/[^A-Z]/g, "")
		.slice(0, 3);
	if (key.length < 2)
		key =
			name
				.replace(/[^A-Za-z]/g, "")
				.slice(0, 3)
				.toUpperCase() || "PRJ";
	while (taken.includes(key) && key.length < 6) key += "X";
	return key;
}

const TEMPLATE_DESC: Record<string, string> = {
	product: "Discovery to launch",
	web: "IA, design, build, launch",
	mkt: "Brief, assets, channels",
	design: "Discovery to handoff",
	software: "Spec, build, ship",
	personal: "Plan your own goals",
};

/** "New project" templates: blank plus the onboarding set, with starter tasks (reference TEMPLATES). */
export const PROJECT_TEMPLATES = [
	{
		id: "blank",
		name: "Blank project",
		icon: "icon-[solar--file-linear]",
		desc: "Start from scratch",
		tasks: [] as readonly string[],
	},
	...TEMPLATES.map((t) => ({ ...t, desc: TEMPLATE_DESC[t.id] ?? "" })),
];

/** Every icon a project may carry: the picker set plus the template icons. */
export const ALL_PROJECT_ICONS: readonly string[] = [
	...PROJECT_ICONS.map(([icon]) => icon),
	...TEMPLATES.map((t) => t.icon),
];

/** Date-only values travel as "YYYY-MM-DD" so they never shift with time zones. */
export const toDay = (date: Date | null | undefined) =>
	date ? date.toISOString().slice(0, 10) : null;
export const fromDay = (day: string) => new Date(`${day}T00:00:00.000Z`);
