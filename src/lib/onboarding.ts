// Shared by the onboarding UI and the GraphQL server.
// Icon values are full Tailwind classes so the Iconify plugin can find them at build time.

export const USE_CASES = [
	{
		id: "product",
		icon: "icon-[solar--target-bold]",
		name: "Product",
		desc: "Roadmaps & launches",
	},
	{
		id: "design",
		icon: "icon-[solar--pallete-2-bold]",
		name: "Design",
		desc: "Reviews & handoff",
	},
	{
		id: "marketing",
		icon: "icon-[hugeicons--megaphone-02]",
		name: "Marketing",
		desc: "Campaigns & content",
	},
	{
		id: "engineering",
		icon: "icon-[solar--code-bold]",
		name: "Engineering",
		desc: "Sprints & releases",
	},
	{
		id: "personal",
		icon: "icon-[solar--user-bold]",
		name: "Personal",
		desc: "Goals & side projects",
	},
	{
		id: "other",
		icon: "icon-[solar--stars-bold]",
		name: "Other",
		desc: "Something else",
	},
] as const;

export const VIEWS = [
	{
		id: "board",
		icon: "icon-[hugeicons--kanban]",
		name: "Boards",
		desc: "Move cards through stages",
		label: "Board",
	},
	{
		id: "list",
		icon: "icon-[solar--checklist-minimalistic-bold]",
		name: "Lists",
		desc: "Checklists and priorities",
		label: "List",
	},
	{
		id: "timeline",
		icon: "icon-[hugeicons--chart-gantt]",
		name: "Timelines",
		desc: "Plan with dates & dependencies",
		label: "Timeline",
	},
	{
		id: "table",
		icon: "icon-[hugeicons--table-01]",
		name: "Tables",
		desc: "Spreadsheet-style tracking",
		label: "Table",
	},
] as const;

export const TEAM_SIZES = [
	"Just me",
	"2-10",
	"11-50",
	"51-200",
	"200+",
] as const;

export const TEMPLATES = [
	{
		id: "product",
		name: "Product Development",
		icon: "icon-[solar--target-bold]",
		tasks: [
			"Define problem statement",
			"User research plan",
			"Write PRD",
			"Design exploration",
			"Build MVP",
			"Beta launch",
		],
	},
	{
		id: "web",
		name: "Website",
		icon: "icon-[solar--global-bold]",
		tasks: [
			"Sitemap & information architecture",
			"Wireframes",
			"Visual design",
			"Build page templates",
			"Content migration",
			"QA & launch",
		],
	},
	{
		id: "mkt",
		name: "Marketing Campaign",
		icon: "icon-[hugeicons--megaphone-02]",
		tasks: [
			"Campaign brief",
			"Audience research",
			"Creative assets",
			"Channel plan",
			"Launch campaign",
			"Performance report",
		],
	},
	{
		id: "design",
		name: "Design Project",
		icon: "icon-[solar--pallete-2-bold]",
		tasks: [
			"Discovery workshop",
			"Moodboard",
			"Concept directions",
			"Refinement",
			"Developer handoff",
		],
	},
	{
		id: "software",
		name: "Software Development",
		icon: "icon-[solar--code-bold]",
		tasks: [
			"Technical spec",
			"Set up repo & CI",
			"Implement core API",
			"Write tests",
			"Code review",
			"Deploy to staging",
		],
	},
	{
		id: "personal",
		name: "Personal Project",
		icon: "icon-[solar--heart-bold]",
		tasks: [
			"Brain dump ideas",
			"Pick top 3 priorities",
			"Schedule focus time",
			"Weekly review",
		],
	},
] as const;

export const MAX_INVITES = 3;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function slugify(value: string) {
	return (
		value
			// "Été" becomes "ete", not "t": split accents off their letters, then drop them
			.normalize("NFKD")
			.replace(/[\u0300-\u036f]/g, "")
			.toLowerCase()
			.trim()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-|-$/g, "")
			.slice(0, 48)
	);
}

// Project colours (same palette as the reference app).
export const PCOLORS: Record<string, string> = {
	indigo: "#5A67D8",
	blue: "#3B82C4",
	violet: "#8662C9",
	teal: "#23918A",
	rose: "#C54B78",
	amber: "#C48A1E",
	green: "#3D8E5F",
	slate: "#6B7280",
};

// Team icons: the reference app's picker set as [Iconify class, label] (written out so Tailwind finds them).
export const TEAM_ICONS = [
	["icon-[solar--users-group-rounded-linear]", "People"],
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
	["icon-[solar--stars-linear]", "Sparkles"],
] as const;
