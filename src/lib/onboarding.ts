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

export type UseCase = (typeof USE_CASES)[number]["id"];
export type DefaultView = (typeof VIEWS)[number]["id"];
export type TeamSize = (typeof TEAM_SIZES)[number];
export type TemplateId = (typeof TEMPLATES)[number]["id"];

export const MAX_INVITES = 3;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function slugify(value: string) {
	return value
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, 48);
}
