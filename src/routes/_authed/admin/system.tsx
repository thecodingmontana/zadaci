import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ErrorTrend } from "#/components/admin/admin-charts";
import {
	AdminHeader,
	EmptyPanel,
	Panel,
	PanelBody,
	PanelHeader,
	StatTile,
} from "#/components/admin/primitives";
import { getAdminSystem } from "#/lib/session";
import { ago } from "#/lib/time";
import { cn } from "#/lib/utils";

// Admin System: is Zadaci healthy? Errors (kept 14 days, since Vercel's logs last an hour), the
// hourly job, GitHub links and the database.

export const Route = createFileRoute("/_authed/admin/system")({
	loader: () => getAdminSystem(),
	component: AdminSystemPage,
});

const HOURLY_LATE_MS = 90 * 60_000;
const SOURCES = ["github", "cron", "client"] as const;
const SOURCE_LABEL: Record<string, string> = {
	github: "GitHub",
	cron: "Hourly job",
	client: "Browser",
};
const RESULT_LABEL: Record<string, string> = {
	people: "People checked",
	reminders: "Reminders sent",
	digests: "Digests sent",
	github: "GitHub links checked",
	"github linked": "GitHub links checked",
	"github unfinished": "GitHub links left for the next run",
	error: "Error",
};

const size = (bytes: number) =>
	bytes > 1e9
		? `${(bytes / 1e9).toFixed(1)} GB`
		: bytes > 1e6
			? `${(bytes / 1e6).toFixed(1)} MB`
			: `${Math.round(bytes / 1e3)} kB`;

function AdminSystemPage() {
	const data = Route.useLoaderData();
	const [source, setSource] = useState<string | null>(null);
	const hourly = data.jobs.find((j) => j.name === "hourly");
	const late =
		!hourly || Date.now() - new Date(hourly.at).getTime() > HOURLY_LATE_MS;
	const errorsDay = SOURCES.reduce((s, k) => s + (data.errorsDay[k] ?? 0), 0);
	const errors = source
		? data.errors.filter((e) => e.source === source)
		: data.errors;
	const boardsOk = data.github.filter((g) => g.boardUrl).length;

	return (
		<div className="grid gap-5 p-5">
			<AdminHeader
				title="System"
				subtitle="Errors, background jobs, GitHub links and the database."
			/>

			<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
				<StatTile
					icon="icon-[hugeicons--clock-01]"
					label="Hourly job"
					value={
						!hourly ? "Not run" : !hourly.ok ? "Failed" : late ? "Late" : "OK"
					}
					note={
						hourly
							? `last ran ${ago(hourly.at)}`
							: "hasn't run since this was added"
					}
				/>
				<StatTile
					icon="icon-[hugeicons--alert-02]"
					label="Errors, 24 hours"
					value={errorsDay}
					note={SOURCES.map(
						(s) => `${SOURCE_LABEL[s]} ${data.errorsDay[s] ?? 0}`,
					).join(" · ")}
				/>
				<StatTile
					icon="icon-[hugeicons--github]"
					label="GitHub links"
					value={data.github.length}
					note={`${boardsOk} with a board on GitHub`}
				/>
				<StatTile
					icon="icon-[hugeicons--database-01]"
					label="Database"
					value={size(data.database.bytes)}
					note="Supabase, all tables"
				/>
			</div>

			<div className="grid items-stretch gap-4 lg:grid-cols-3">
				<Panel className="lg:col-span-2">
					<PanelHeader
						icon="icon-[hugeicons--alert-02]"
						title="Errors"
						subtitle="Per day and where they came from, last 30 days"
					/>
					<PanelBody>
						<ErrorTrend daily={data.errorsDaily} />
					</PanelBody>
				</Panel>
				<Panel>
					<PanelHeader
						icon="icon-[hugeicons--clock-01]"
						title="Hourly job"
						subtitle="Reminders, digests and GitHub repair"
						action={
							hourly && (
								<span
									className={cn(
										"rounded-full px-2 py-0.5 font-medium text-[11px]",
										!hourly.ok || late
											? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
											: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
									)}
								>
									{!hourly.ok ? "Failed" : late ? "Late" : "On time"}
								</span>
							)
						}
					/>
					{hourly ? (
						<PanelBody className="gap-0 p-0">
							<ul className="divide-y">
								<li className="flex justify-between px-4 py-2.5 text-[13px]">
									<span className="text-muted-foreground">Last run</span>
									<span>{ago(hourly.at)}</span>
								</li>
								{Object.entries(hourly.result).map(([k, v]) => (
									<li
										key={k}
										className="flex justify-between gap-3 px-4 py-2.5 text-[13px]"
									>
										<span className="text-muted-foreground">
											{RESULT_LABEL[k] ?? k}
										</span>
										<span className="truncate font-mono tabular-nums">
											{String(v)}
										</span>
									</li>
								))}
							</ul>
							{late && (
								<p className="border-t px-4 py-2.5 text-[12px] text-muted-foreground">
									GitHub runs the schedule late or skips runs at times.
								</p>
							)}
						</PanelBody>
					) : (
						<EmptyPanel
							icon="icon-[hugeicons--clock-01]"
							message="It hasn't run since this page was added."
						/>
					)}
				</Panel>
			</div>

			<Panel>
				<PanelHeader
					icon="icon-[hugeicons--file-02]"
					title="Error log"
					subtitle="Kept 14 days. Task and project ids only, never their text."
					action={
						<div className="flex gap-1">
							{[null, ...SOURCES].map((s) => (
								<button
									key={s ?? "all"}
									type="button"
									className={cn(
										"btn btn-sm",
										source === s ? "btn-secondary" : "btn-ghost",
									)}
									aria-pressed={source === s}
									onClick={() => setSource(s)}
								>
									{s ? SOURCE_LABEL[s] : "All"}
								</button>
							))}
						</div>
					}
				/>
				{errors.length ? (
					<ul className="max-h-[420px] divide-y overflow-y-auto">
						{errors.map((e) => (
							<li
								key={e.id}
								className="grid grid-cols-[72px_88px_1fr] gap-3 px-4 py-2.5 text-[12.5px]"
							>
								<span className="text-muted-foreground">{ago(e.at)}</span>
								<span>{SOURCE_LABEL[e.source] ?? e.source}</span>
								<span className="font-mono [overflow-wrap:anywhere]">
									{e.message}
								</span>
							</li>
						))}
					</ul>
				) : (
					<EmptyPanel
						icon="icon-[hugeicons--checkmark-circle-02]"
						message="No errors in the last 14 days."
					/>
				)}
			</Panel>

			<div className="grid items-stretch gap-4 lg:grid-cols-3">
				<Panel className="lg:col-span-2">
					<PanelHeader
						icon="icon-[hugeicons--github]"
						title="GitHub links"
						subtitle="Projects linked to a repo, their issues and board"
					/>
					{data.github.length ? (
						<ul className="divide-y">
							{data.github.map((g) => (
								<li
									key={g.repo + g.workspace}
									className="grid gap-0.5 px-4 py-2.5 text-[13px]"
								>
									<span className="flex items-center gap-2">
										<a
											className="grow truncate font-medium hover:underline"
											href={`https://github.com/${g.repo}`}
											target="_blank"
											rel="noopener noreferrer"
										>
											{g.repo}
										</a>
										<span className="font-mono text-muted-foreground tabular-nums">
											{g.viaApp ? `${g.issues} issues` : "webhook only"}
										</span>
									</span>
									<span className="text-[12px] text-muted-foreground">
										{g.project} ({g.workspace}) · linked by{" "}
										{g.linkedBy ?? "someone who left"} ·{" "}
										{g.boardUrl ? (
											<a
												className="text-brand hover:underline"
												href={g.boardUrl}
												target="_blank"
												rel="noopener noreferrer"
											>
												board
											</a>
										) : (
											(g.boardError ?? "no board")
										)}
									</span>
								</li>
							))}
						</ul>
					) : (
						<EmptyPanel
							icon="icon-[hugeicons--github]"
							message="No project is linked to GitHub."
						/>
					)}
				</Panel>
				<Panel>
					<PanelHeader
						icon="icon-[hugeicons--database-01]"
						title="Biggest tables"
						subtitle="Row counts are Postgres's estimate"
					/>
					<ul className="divide-y">
						{data.database.biggest.map((b) => (
							<li
								key={b.name}
								className="flex items-center gap-3 px-4 py-2.5 text-[13px]"
							>
								<span className="grow truncate font-mono text-[12px]">
									{b.name.replace(/^app_/, "")}
								</span>
								<span className="text-muted-foreground tabular-nums">
									{b.rows.toLocaleString()} rows
								</span>
								<span className="w-16 text-right font-mono tabular-nums">
									{size(b.bytes)}
								</span>
							</li>
						))}
					</ul>
				</Panel>
			</div>
		</div>
	);
}
