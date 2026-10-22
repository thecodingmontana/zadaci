import { z } from "zod";

// Option lists for Settings, shared by the UI and the GraphQL validation (ported from the reference app).

export const LANGS = [
	["en-US", "English (US)"],
	["en-GB", "English (UK)"],
] as const;

export const DATE_FMTS = [
	["MMM d", "Oct 1"],
	["d/M", "1/10"],
	["M/d", "10/1"],
	["yyyy-MM-dd", "2026-10-01"],
] as const;

export const WEEK_STARTS = [
	["1", "Monday"],
	["0", "Sunday"],
	["6", "Saturday"],
] as const;

export const TIME_FMTS = [
	["12", "12-hour (2:30 PM)"],
	["24", "24-hour (14:30)"],
] as const;

export const HOME_OPTS = [
	["home", "Home"],
	["my-tasks", "My Tasks"],
	["inbox", "Inbox"],
] as const;

export const OPEN_TASKS = [
	["drawer", "Side panel"],
	["full", "Full page"],
] as const;

export const AVATAR_COLORS = [
	"#5A67D8",
	"#C54B78",
	"#3B82C4",
	"#23918A",
	"#C48A1E",
	"#8662C9",
] as const;
export const WS_COLORS = [
	"#2F2E2A",
	"#5A67D8",
	"#3B82C4",
	"#23918A",
	"#C54B78",
	"#C48A1E",
] as const;

// the hour (0-23, the person's own time) for the morning digest and due-date reminders
export const DIGEST_HOURS = Array.from(
	{ length: 24 },
	(_, h) => [String(h), String(h)] as const,
);

export const NOTIF_KEYS = [
	"email_mention",
	"email_assign",
	"email_comment",
	"email_digest",
	"push_mention",
	"push_assign",
	"push_comment",
	"push_due",
	"mention_all",
	"mention_team",
	"mention_ws",
	"assign_self",
	"assign_status",
	"assign_over",
] as const;

const values = <T extends readonly (readonly [string, string])[]>(list: T) =>
	list.map(([v]) => v) as unknown as [T[number][0], ...T[number][0][]];

export const preferencesPatch = z
	.object({
		lang: z.enum(values(LANGS)),
		spell: z.boolean(),
		tz: z.string().max(64),
		// the browser's zone, saved quietly so "Automatic" also works for emails
		autoTz: z.string().max(64),
		digestHour: z.enum(values(DIGEST_HOURS)),
		dateFmt: z.enum(values(DATE_FMTS)),
		weekStart: z.enum(values(WEEK_STARTS)),
		timeFmt: z.enum(values(TIME_FMTS)),
		title: z.string().trim().max(100),
		avatarColor: z.enum(AVATAR_COLORS),
		home: z.enum(values(HOME_OPTS)),
		openTasks: z.enum(values(OPEN_TASKS)),
		confirmDel: z.boolean(),
		notif: z
			.object(Object.fromEntries(NOTIF_KEYS.map((k) => [k, z.boolean()])))
			.partial()
			.strict(),
	})
	.partial()
	.strict();

export type Preferences = z.infer<typeof preferencesPatch>;

export const PREF_DEFAULTS = {
	lang: "en-US",
	spell: true,
	tz: "",
	autoTz: "",
	digestHour: "8",
	dateFmt: "MMM d",
	weekStart: "1",
	timeFmt: "12",
	title: "",
	avatarColor: "#5A67D8",
	home: "home",
	openTasks: "drawer",
	confirmDel: true,
	notif: {
		email_mention: true,
		email_assign: true,
		email_comment: false,
		email_digest: true,
		push_mention: true,
		push_assign: true,
		push_comment: true,
		push_due: true,
		mention_all: true,
		mention_team: true,
		mention_ws: false,
		assign_self: true,
		assign_status: true,
		assign_over: true,
	} as Record<(typeof NOTIF_KEYS)[number], boolean>,
} satisfies Required<Preferences>;

export const workspaceSettingsPatch = z
	.object({
		permCreate: z.boolean(),
		permGuests: z.boolean(),
		permPublic: z.boolean(),
		showDoneBoard: z.boolean(),
		// custom role permissions: permission key -> roles allowed (see lib/permissions)
		permOverrides: z
			.record(
				z.string().max(40),
				z.array(z.enum(["moderator", "member", "guest"])).max(3),
			)
			.refine((o) => Object.keys(o).length <= 40, "Too many permissions"),
	})
	.partial()
	.strict();
// permPublic: public share links (graphql/share.server) only work while it is on
export const WS_SETTINGS_DEFAULTS = {
	permCreate: true,
	permGuests: true,
	permPublic: false,
	showDoneBoard: true,
	permOverrides: {} as Record<string, string[]>,
};

export type ResolvedPreferences = typeof PREF_DEFAULTS;

export const ROLE_LABEL: Record<string, string> = {
	owner: "Owner",
	moderator: "Admin",
	member: "Member",
	guest: "Guest",
};
