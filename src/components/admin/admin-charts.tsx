import { useState } from "react";
import { EvilBarChart } from "#/components/evilcharts/charts/recharts-bar-chart";
import { EvilHeatmapChart } from "#/components/evilcharts/charts/recharts-heatmap-chart";
import { EvilPieChart } from "#/components/evilcharts/charts/recharts-pie-chart";
import type { AdminDashboard } from "#/lib/admin-analytics.server";
import { cn } from "#/lib/utils";
import {
	change,
	Delta,
	EmptyPanel,
	Panel,
	PanelBody,
	PanelHeader,
} from "./primitives";

// The Dashboard's charts (EvilCharts). One series in Zadaci's orange; splits use the validated
// categorical order (blue, orange, aqua, yellow, magenta, green), each with its own dark step.

const SLOTS = [
	{ light: "#2a78d6", dark: "#3987e5" },
	{ light: "#eb6834", dark: "#d95926" },
	{ light: "#1baf7a", dark: "#199e70" },
	{ light: "#eda100", dark: "#c98500" },
	{ light: "#e87ba4", dark: "#d55181" },
	{ light: "#008300", dark: "#008300" },
];

type Day = AdminDashboard["daily"][number];

const shortDay = (day: string) =>
	new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
		timeZone: "UTC",
	});

/** Totals of a daily metric over the last 30 days and the 30 before them. */
export function periods(daily: Day[], pick: (d: Day) => number) {
	const half = daily.length - 30;
	const sum = (rows: Day[]) => rows.reduce((s, r) => s + pick(r), 0);
	return { now: sum(daily.slice(half)), before: sum(daily.slice(0, half)) };
}

const messages = (d: Day) => d.comments + d.chat + d.assistant;

/** The headline trend, with its metrics as tabs underneath: picking one redraws the chart. */
export function ActivityTrend({ data }: { data: AdminDashboard }) {
	const last30 = data.daily.slice(-30);
	const tabs = [
		{
			key: "active",
			label: "Active people",
			icon: "icon-[hugeicons--user-multiple]",
			pick: (d: Day) => d.active,
			// distinct over the whole period, not the sum of each day's
			totals: data.totals.active,
		},
		{
			key: "signups",
			label: "Sign-ups",
			icon: "icon-[hugeicons--user-add-01]",
			pick: (d: Day) => d.signups,
		},
		{
			key: "created",
			label: "Tasks made",
			icon: "icon-[hugeicons--task-add-01]",
			pick: (d: Day) => d.created,
		},
		{
			key: "completed",
			label: "Tasks done",
			icon: "icon-[hugeicons--task-done-01]",
			pick: (d: Day) => d.completed,
		},
		{
			key: "messages",
			label: "Messages",
			icon: "icon-[hugeicons--message-multiple-01]",
			pick: messages,
		},
		{
			key: "signIns",
			label: "Sign-ins",
			icon: "icon-[hugeicons--login-03]",
			pick: (d: Day) => d.signIns,
		},
	] as const;
	const [active, setActive] = useState<string>(tabs[0].key);
	const tab = tabs.find((t) => t.key === active) ?? tabs[0];
	const chart = last30.map((d) => ({
		label: shortDay(d.day),
		value: tab.pick(d),
	}));
	const empty = chart.every((p) => p.value === 0);

	return (
		<Panel>
			<PanelHeader
				icon="icon-[hugeicons--analytics-01]"
				title="Activity"
				subtitle="Day by day, last 30 days"
			/>
			<PanelBody className="pb-0">
				{empty ? (
					<div className="flex h-60 items-center justify-center">
						<EmptyPanel
							icon="icon-[hugeicons--chart-increase]"
							message={`No ${tab.label.toLowerCase()} in the last 30 days.`}
						/>
					</div>
				) : (
					<div className="h-60 w-full">
						<EvilBarChart
							className="h-full w-full"
							data={chart}
							xDataKey="label"
							config={
								{
									value: {
										label: tab.label,
										colors: { light: ["#eb6834"], dark: ["#d95926"] },
									},
								} as never
							}
						>
							<EvilBarChart.Grid />
							<EvilBarChart.XAxis dataKey="label" fontSize={11} />
							<EvilBarChart.YAxis fontSize={11} allowDecimals={false} />
							<EvilBarChart.Tooltip />
							<EvilBarChart.Bar dataKey="value" variant="gradient" />
						</EvilBarChart>
					</div>
				)}
			</PanelBody>
			<div className="mt-4 grid grid-cols-2 border-t lg:grid-cols-3 xl:grid-cols-6">
				{tabs.map((t, i) => {
					const on = t.key === tab.key;
					const p = "totals" in t ? t.totals : periods(data.daily, t.pick);
					return (
						<button
							type="button"
							key={t.key}
							aria-pressed={on}
							onClick={() => setActive(t.key)}
							className={cn(
								"flex flex-col gap-1.5 border-t p-4 text-left transition-colors xl:border-t-0",
								i % 2 === 1 && "border-l",
								i > 0 && "xl:border-l",
								on ? "bg-brand/5" : "hover:bg-accent/60",
							)}
						>
							<span className="flex items-center gap-1.5">
								<span
									className={cn(
										t.icon,
										"size-3.5 shrink-0",
										on ? "text-brand" : "text-muted-foreground",
									)}
									aria-hidden="true"
								/>
								<span className="truncate text-[12px] text-muted-foreground">
									{t.label}
								</span>
							</span>
							<span className="font-mono font-semibold text-xl tabular-nums tracking-tight">
								{p.now.toLocaleString()}
							</span>
							<Delta percent={change(p.now, p.before)} suffix="vs prev." />
						</button>
					);
				})}
			</div>
		</Panel>
	);
}

/** How one total splits up (task statuses, sign-in methods, models): a donut and its list. */
export function SplitPanel({
	title,
	subtitle,
	icon,
	rows,
	label,
	empty,
}: {
	title: string;
	subtitle: string;
	icon: string;
	rows: { key: string; n: number }[];
	label: (key: string) => string;
	empty: string;
}) {
	// past six slices the rest fold into "Other", so a color never repeats
	const top = rows.slice(0, 5);
	const rest = rows.slice(5).reduce((s, r) => s + r.n, 0);
	const items = [
		...top.map((r) => ({ name: label(r.key), n: r.n })),
		...(rest ? [{ name: "Other", n: rest }] : []),
	];
	const sum = items.reduce((s, r) => s + r.n, 0);
	// fixed keys: the chart turns keys into CSS names, and these values come from the database
	const data = items.map((r, i) => ({ slot: `s${i}`, n: r.n }));
	const config = Object.fromEntries(
		items.map((r, i) => [
			`s${i}`,
			{
				label: r.name,
				colors: { light: [SLOTS[i].light], dark: [SLOTS[i].dark] },
			},
		]),
	);
	return (
		<Panel>
			<PanelHeader icon={icon} title={title} subtitle={subtitle} />
			<PanelBody className="gap-4">
				{sum === 0 ? (
					<EmptyPanel icon={icon} message={empty} />
				) : (
					<>
						<p className="font-mono font-semibold text-2xl tabular-nums tracking-tight">
							{sum.toLocaleString()}
						</p>
						<div className="flex flex-wrap items-center gap-5">
							<div className="size-36 shrink-0">
								<EvilPieChart
									className="h-full w-full"
									data={data}
									dataKey="n"
									nameKey="slot"
									config={config as never}
								>
									<EvilPieChart.Tooltip />
									<EvilPieChart.Pie innerRadius="62%" />
								</EvilPieChart>
							</div>
							<ul className="grid min-w-40 flex-1 gap-2.5">
								{items.map((r, i) => (
									<li
										key={r.name}
										className="flex items-center gap-2 text-[13px]"
									>
										<span
											className="size-2.5 shrink-0 rounded-full"
											style={{ background: SLOTS[i].light }}
											aria-hidden="true"
										/>
										<span className="grow truncate">{r.name}</span>
										<span className="font-mono tabular-nums">
											{r.n.toLocaleString()}
										</span>
										<span className="w-10 text-right text-muted-foreground tabular-nums">
											{Math.round((r.n / sum) * 100)}%
										</span>
									</li>
								))}
							</ul>
						</div>
					</>
				)}
			</PanelBody>
		</Panel>
	);
}

/** Every change made in Zadaci, one square per day, last 6 months. */
export function ActivityHeatmap({ data }: { data: AdminDashboard }) {
	const total = data.heatmap.reduce((s, d) => s + d.value, 0);
	return (
		<Panel>
			<PanelHeader
				icon="icon-[hugeicons--calendar-03]"
				title="Changes made"
				subtitle="Every change in every workspace, last 6 months"
				action={
					<span className="text-[12px] text-muted-foreground tabular-nums">
						{total.toLocaleString()} changes
					</span>
				}
			/>
			<PanelBody>
				<div className="h-44 w-full">
					<EvilHeatmapChart
						className="h-full w-full"
						data={data.heatmap}
						config={{
							changes: {
								label: "Changes",
								colors: {
									light: ["#fbd9c9", "#f5a47f", "#eb6834", "#b8461b"],
									dark: ["#5a2a14", "#9a4520", "#d95926", "#f5a47f"],
								},
							},
						}}
					>
						<EvilHeatmapChart.Cell dataKey="changes" />
						<EvilHeatmapChart.MonthLabel />
						<EvilHeatmapChart.DayLabel />
						<EvilHeatmapChart.Tooltip />
						<EvilHeatmapChart.Legend />
					</EvilHeatmapChart>
				</div>
			</PanelBody>
		</Panel>
	);
}

/** Errors per day, stacked by where they came from (System page). */
export function ErrorTrend({
	daily,
}: {
	daily: { day: string; github: number; cron: number; client: number }[];
}) {
	const chart = daily.slice(-30).map((d) => ({ ...d, label: shortDay(d.day) }));
	const empty = chart.every((d) => d.github + d.cron + d.client === 0);
	if (empty)
		return (
			<EmptyPanel
				icon="icon-[hugeicons--checkmark-circle-02]"
				message="No errors in the last 30 days."
			/>
		);
	return (
		<div className="h-56 w-full">
			<EvilBarChart
				className="h-full w-full"
				data={chart}
				xDataKey="label"
				stackType="stacked"
				config={
					{
						github: {
							label: "GitHub",
							colors: { light: [SLOTS[0].light], dark: [SLOTS[0].dark] },
						},
						cron: {
							label: "Hourly job",
							colors: { light: [SLOTS[1].light], dark: [SLOTS[1].dark] },
						},
						client: {
							label: "Browser",
							colors: { light: [SLOTS[2].light], dark: [SLOTS[2].dark] },
						},
					} as never
				}
			>
				<EvilBarChart.Grid />
				<EvilBarChart.XAxis dataKey="label" fontSize={11} />
				<EvilBarChart.YAxis fontSize={11} allowDecimals={false} />
				<EvilBarChart.Legend isClickable />
				<EvilBarChart.Tooltip />
				<EvilBarChart.Bar dataKey="github" isClickable />
				<EvilBarChart.Bar dataKey="cron" isClickable />
				<EvilBarChart.Bar dataKey="client" isClickable />
			</EvilBarChart>
		</div>
	);
}
