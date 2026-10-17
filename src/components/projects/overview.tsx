import { useMutation } from "@apollo/client/react";
import { Link } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { ActivityItem } from "#/components/activity/activity-item";
import { Av, AvStack } from "#/components/q/av";
import { StatusIcon } from "#/components/q/status-icon";
import {
	type ActivityItem as Activity,
	ADD_MILESTONE,
	DELETE_MILESTONE,
	type ProjectDetail,
	type ProjectStats,
	type SettingsMember,
	type SettingsTeam,
	UPDATE_PROJECT,
} from "#/graphql/operations";
import { hasRight } from "#/lib/permissions";
import { pstat } from "#/lib/projects";
import { isClosed, TASK_STATUSES } from "#/lib/tasks";
import { daysUntil, fmtDay } from "#/lib/time";
import { toast } from "#/lib/toast";
import { cn } from "#/lib/utils";
import { isOverdue } from "#/lib/view-engine";
import { PStatus, projectColor, StatusMenu } from "./bits";

// Ported from the reference app's project overview (views/project-overview.js).

const REFETCH = {
	refetchQueries: ["ProjectPage", "Shell", "Projects", "Activity"],
};

export function ProjectOverview({
	slug,
	project,
	stats,
	members,
	teams,
	activity,
	meId,
	onEdit,
	onShare,
}: {
	slug: string;
	project: ProjectDetail;
	stats: ProjectStats | undefined;
	members: SettingsMember[];
	teams: SettingsTeam[];
	activity: Activity[];
	meId: string;
	onEdit: () => void;
	onShare: () => void;
}) {
	const canEdit = hasRight(project.myAccess, "edit");
	const [update] = useMutation(UPDATE_PROJECT, REFETCH);
	const total = stats?.total ?? 0;
	const done = stats?.done ?? 0;
	const pct = total ? Math.round((done / total) * 100) : 0;
	const count = (status: string) =>
		stats?.statusCounts.find((c) => c.status === status)?.count ?? 0;
	const soon = project.tasks
		.filter((t) => !isClosed(t.status) && t.dueDate)
		.sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))
		.slice(0, 6);
	const lead = members.find((m) => m.id === project.leadId);
	const team = teams.find((t) => t.id === project.teamId);
	const left = project.dueDate ? daysUntil(project.dueDate) : null;
	// counted here so "today" is the viewer's day, like the task lists
	const overdue = project.tasks.filter((t) => isOverdue(t)).length;

	return (
		<div className="page" style={{ maxWidth: 1160, paddingTop: 22 }}>
			<div className="grid2">
				<div className="stack">
					<section className="panel">
						<div className="panel-h">
							<h2>About</h2>
							{canEdit && (
								<div className="acts">
									<button
										type="button"
										className="btn btn-sm btn-ghost"
										onClick={onEdit}
									>
										<span
											className="icon-[solar--pen-linear] size-[13px]"
											aria-hidden="true"
										/>
										Edit
									</button>
								</div>
							)}
						</div>
						<div
							className="panel-b"
							style={{
								fontSize: 14,
								lineHeight: 1.6,
								color: "var(--q-text)",
								whiteSpace: "pre-wrap",
							}}
						>
							{project.description || (
								<span className="faint">No description yet.</span>
							)}
						</div>
					</section>
					<section className="panel">
						<div className="panel-h">
							<h2>Progress</h2>
							<div className="acts">
								<span className="faint" style={{ fontSize: 12 }}>
									{done} of {total} tasks done
								</span>
							</div>
						</div>
						<div className="panel-b">
							<div
								className="row"
								style={{ alignItems: "baseline", gap: 10, marginBottom: 10 }}
							>
								<span
									className="num"
									style={{
										fontSize: 30,
										fontWeight: 600,
										letterSpacing: "-.03em",
									}}
								>
									{pct}%
								</span>
								{left !== null && project.dueDate && (
									<span className="muted" suppressHydrationWarning>
										{left >= 0
											? `${left} days until ${fmtDay(project.dueDate)}`
											: `Ended ${fmtDay(project.dueDate)}`}
									</span>
								)}
								{!!overdue && (
									<span className="badge red">
										<span
											className="icon-[solar--alarm-linear] size-[11px]"
											aria-hidden="true"
										/>
										{overdue} overdue
									</span>
								)}
							</div>
							<div className="stackbar" style={{ height: 8, marginBottom: 12 }}>
								{TASK_STATUSES.map((s) => (
									<i
										key={s.id}
										style={{
											width: `${(count(s.id) / Math.max(total, 1)) * 100}%`,
											background: `var(--q-st-${s.st})`,
										}}
										title={`${s.name}: ${count(s.id)}`}
									/>
								))}
							</div>
							<div
								className="row"
								style={{ flexWrap: "wrap", gap: 14, fontSize: 12.5 }}
							>
								{TASK_STATUSES.map((s) => (
									<Link
										key={s.id}
										to="/w/$slug/p/$projectId"
										params={{ slug, projectId: project.id }}
										search={{ tab: "list" }}
										className="row"
										style={{ gap: 5 }}
									>
										<StatusIcon status={s.id} size={12} />
										<span className="muted">{s.name}</span>
										<b className="num" style={{ fontWeight: 600 }}>
											{count(s.id)}
										</b>
									</Link>
								))}
							</div>
						</div>
					</section>
					<section className="panel">
						<div className="panel-h">
							<h2>Coming up</h2>
							<div className="acts">
								<Link
									to="/w/$slug/p/$projectId"
									params={{ slug, projectId: project.id }}
									search={{ tab: "list" }}
									className="btn btn-sm btn-ghost"
								>
									View list
								</Link>
							</div>
						</div>
						{soon.length ? (
							soon.map((t) => (
								<div key={t.id} className="mini" style={{ cursor: "default" }}>
									<StatusIcon status={t.status} />
									<span className="tt">{t.name}</span>
									<span
										className="num"
										style={{
											fontSize: 12,
											color:
												t.dueDate && daysUntil(t.dueDate) < 0
													? "var(--q-red)"
													: "var(--q-text-3)",
										}}
										suppressHydrationWarning
									>
										{fmtDay(t.dueDate)}
									</span>
								</div>
							))
						) : (
							<div className="empty-state sm">
								<div className="glyph">
									<span
										className="icon-[solar--check-circle-linear] size-5"
										aria-hidden="true"
									/>
								</div>
								<h3 className="es-h">Nothing scheduled</h3>
								<p>Tasks with due dates will show up here.</p>
							</div>
						)}
					</section>
				</div>
				<div className="stack">
					<section className="panel">
						<div className="panel-h">
							<h2>Details</h2>
						</div>
						<div className="panel-b">
							<dl className="kv">
								<dt>
									<span
										className="icon-[solar--record-circle-linear] size-3.5"
										aria-hidden="true"
									/>
									Status
								</dt>
								<dd>
									<StatusMenu
										status={project.status}
										disabled={!canEdit}
										className="pillbtn"
										onPick={(status) =>
											toast
												.promise(
													update({
														variables: {
															slug,
															projectId: project.id,
															input: { status },
														},
													}),
													{
														loading: "Changing the status…",
														success: `${project.title} marked ${pstat(status).name}`,
														error: "Couldn't change the status",
													},
												)
												.catch(() => {})
										}
									>
										<PStatus status={project.status} />
									</StatusMenu>
								</dd>
								<dt>
									<span
										className="icon-[solar--user-linear] size-3.5"
										aria-hidden="true"
									/>
									Lead
								</dt>
								<dd>
									<span className="pillbtn">
										{lead ? (
											<>
												<Av
													name={lead.name}
													image={lead.image}
													className="sm"
												/>
												{lead.name}
											</>
										) : (
											<span className="faint">No lead</span>
										)}
									</span>
								</dd>
								<dt>
									<span
										className="icon-[solar--users-group-rounded-linear] size-3.5"
										aria-hidden="true"
									/>
									Team
								</dt>
								<dd>
									{team ? (
										<Link
											to="/w/$slug/teams/$teamId"
											params={{ slug, teamId: team.id }}
											className="pillbtn"
										>
											<span
												className={cn(
													team.icon ??
														"icon-[solar--users-group-rounded-linear]",
													"size-[13px]",
												)}
												aria-hidden="true"
											/>
											{team.name}
										</Link>
									) : (
										<span className="pillbtn faint">No team</span>
									)}
								</dd>
								<dt>
									<span
										className="icon-[solar--calendar-linear] size-3.5"
										aria-hidden="true"
									/>
									Start
								</dt>
								<dd>
									<span className="pillbtn num">
										{fmtDay(project.startDate, true)}
									</span>
								</dd>
								<dt>
									<span
										className="icon-[solar--flag-linear] size-3.5"
										aria-hidden="true"
									/>
									Due
								</dt>
								<dd>
									<span className="pillbtn num">
										{fmtDay(project.dueDate, true)}
									</span>
								</dd>
								<dt>
									<span
										className="icon-[solar--user-plus-linear] size-3.5"
										aria-hidden="true"
									/>
									Members
								</dt>
								<dd>
									<button type="button" className="pillbtn" onClick={onShare}>
										<AvStack
											people={project.members.map((m) => ({
												id: m.memberId,
												name: m.name,
												image: m.image,
											}))}
											max={6}
										/>
										<span className="faint">{project.members.length}</span>
									</button>
								</dd>
							</dl>
						</div>
					</section>
					<Milestones slug={slug} project={project} canEdit={canEdit} />
					<section className="panel">
						<div className="panel-h">
							<h2>Recent activity</h2>
							<div className="acts">
								<Link
									to="/w/$slug/p/$projectId"
									params={{ slug, projectId: project.id }}
									search={{ tab: "activity" }}
									className="btn btn-sm btn-ghost"
								>
									View all
								</Link>
							</div>
						</div>
						<div className="panel-b feed">
							{activity.length ? (
								activity
									.slice(0, 6)
									.map((a) => (
										<ActivityItem key={a.id} slug={slug} a={a} meId={meId} />
									))
							) : (
								<span className="faint">No activity yet</span>
							)}
						</div>
					</section>
				</div>
			</div>
		</div>
	);
}

/** Diamonds by date (green once passed); editors can add and remove them. */
function Milestones({
	slug,
	project,
	canEdit,
}: {
	slug: string;
	project: ProjectDetail;
	canEdit: boolean;
}) {
	const [adding, setAdding] = useState(false);
	const [name, setName] = useState("");
	const [date, setDate] = useState("");
	const [add, { loading }] = useMutation(ADD_MILESTONE, REFETCH);
	const [remove] = useMutation(DELETE_MILESTONE, REFETCH);

	async function submit(event: FormEvent) {
		event.preventDefault();
		if (!name.trim() || !date) return;
		try {
			await toast.promise(
				add({
					variables: { slug, projectId: project.id, name: name.trim(), date },
				}),
				{
					loading: "Adding milestone…",
					success: `Added “${name.trim()}”`,
					error: "Couldn't add the milestone",
				},
			);
			setName("");
			setDate("");
			setAdding(false);
		} catch {
			// the toast already shows why
		}
	}

	return (
		<section className="panel">
			<div className="panel-h">
				<h2>Milestones</h2>
				{canEdit && !adding && (
					<div className="acts">
						<button
							type="button"
							className="btn btn-sm btn-ghost"
							onClick={() => setAdding(true)}
						>
							<span
								className="icon-[hugeicons--plus-sign] size-[13px]"
								aria-hidden="true"
							/>
							Add
						</button>
					</div>
				)}
			</div>
			<div className="panel-b">
				{project.milestones.map((m) => {
					const passed = daysUntil(m.date) < 0;
					return (
						<div
							key={m.id}
							className="row"
							style={{ height: 32, fontSize: 13 }}
						>
							<span
								style={{
									width: 9,
									height: 9,
									transform: "rotate(45deg)",
									borderRadius: 2,
									flexShrink: 0,
									margin: "0 3px",
									background: passed
										? "var(--q-green)"
										: projectColor(project.color),
								}}
								aria-hidden="true"
							/>
							<span className={cn("grow trunc", passed && "faint")}>
								{m.name}
							</span>
							<span className="num muted">{fmtDay(m.date)}</span>
							{canEdit && (
								<button
									type="button"
									className="ibtn ibtn-xs"
									aria-label={`Remove ${m.name}`}
									onClick={() =>
										toast
											.promise(
												remove({
													variables: { slug, projectId: project.id, id: m.id },
												}),
												{
													loading: `Removing “${m.name}”…`,
													success: `Removed “${m.name}”`,
													error: "Couldn't remove the milestone",
												},
											)
											.catch(() => {})
									}
								>
									<span
										className="icon-[solar--close-circle-linear] size-3.5"
										aria-hidden="true"
									/>
								</button>
							)}
						</div>
					);
				})}
				{!project.milestones.length && !adding && (
					<span className="faint">No milestones yet</span>
				)}
				{adding && (
					<form
						className="row"
						style={{ gap: 6, marginTop: 6 }}
						onSubmit={submit}
					>
						<input
							className="input grow"
							placeholder="Milestone name"
							aria-label="Milestone name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							maxLength={255}
							// biome-ignore lint/a11y/noAutofocus: opened by the Add button to type straight away
							autoFocus
						/>
						<input
							type="date"
							className="input"
							style={{ width: 140 }}
							aria-label="Milestone date"
							value={date}
							onChange={(e) => setDate(e.target.value)}
						/>
						<button
							type="submit"
							className={cn("btn btn-primary btn-sm", loading && "is-loading")}
							disabled={!name.trim() || !date || loading}
						>
							Save
						</button>
						<button
							type="button"
							className="btn btn-ghost btn-sm"
							onClick={() => setAdding(false)}
						>
							Cancel
						</button>
					</form>
				)}
			</div>
		</section>
	);
}
