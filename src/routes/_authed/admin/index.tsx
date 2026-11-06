import { createFileRoute } from "@tanstack/react-router";
import {
	ActivityHeatmap,
	ActivityTrend,
	periods,
	SplitPanel,
} from "#/components/admin/admin-charts";
import {
	AdminHeader,
	change,
	Panel,
	PanelBody,
	PanelHeader,
	StatTile,
} from "#/components/admin/primitives";
import { getAdminDashboard } from "#/lib/session";
import { ago } from "#/lib/time";

// Admin Dashboard: how Zadaci is used, at a glance and day by day.

export const Route = createFileRoute("/_authed/admin/")({
	loader: () => getAdminDashboard(),
	component: AdminDashboardPage,
});

const STATUS_LABEL: Record<string, string> = {
	idea: "Idea",
	todo: "To do",
	in_progress: "In progress",
	in_review: "Review",
	completed: "Done",
};
const METHOD_LABEL: Record<string, string> = {
	credential: "Password",
	google: "Google",
	"magic-link": "Email link",
	passkey: "Passkey",
};

function AdminDashboardPage() {
	const data = Route.useLoaderData();
	const { user } = Route.useRouteContext() as { user: { name: string } };
	const t = data.totals;
	const signups = periods(data.daily, (d) => d.signups);
	const made = periods(data.daily, (d) => d.created);
	const done = periods(data.daily, (d) => d.completed);

	return (
		<div className="grid gap-5 p-5">
			<AdminHeader
				title={`Welcome back, ${user.name.split(" ")[0]}`}
				subtitle={`How Zadaci is doing across every workspace. Checked ${ago(data.at)}.`}
			/>

			<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
				<StatTile
					icon="icon-[hugeicons--user-multiple]"
					label="People"
					value={t.people}
					delta={change(signups.now, signups.before)}
					deltaSuffix="new vs previous 30 days"
					note={`${signups.now} joined in 30 days · ${t.signedIn} signed in`}
				/>
				<StatTile
					icon="icon-[hugeicons--user-check-01]"
					label="Active people"
					value={t.active.now}
					delta={change(t.active.now, t.active.before)}
					note="changed something in the last 30 days"
				/>
				<StatTile
					icon="icon-[hugeicons--building-03]"
					label="Workspaces"
					value={t.workspaces}
					note={`${t.projects.toLocaleString()} projects`}
				/>
				<StatTile
					icon="icon-[hugeicons--task-01]"
					label="Tasks"
					value={t.tasks}
					delta={change(made.now, made.before)}
					deltaSuffix="made vs previous 30 days"
					note={`${made.now} made · ${done.now} done in 30 days`}
				/>
			</div>

			<ActivityTrend data={data} />

			<div className="grid items-stretch gap-4 lg:grid-cols-3">
				<SplitPanel
					title="Tasks by status"
					subtitle="Every task that isn't deleted"
					icon="icon-[hugeicons--layers-01]"
					rows={data.statuses}
					label={(k) => STATUS_LABEL[k] ?? k}
					empty="No tasks yet."
				/>
				<SplitPanel
					title="Sign-in methods"
					subtitle="How people's accounts sign in"
					icon="icon-[hugeicons--login-03]"
					rows={data.providers}
					label={(k) => METHOD_LABEL[k] ?? k}
					empty="No sign-in methods recorded yet."
				/>
				<SplitPanel
					title="Assistant models"
					subtitle="Which model answered, last 30 days"
					icon="icon-[hugeicons--ai-brain-02]"
					rows={data.models}
					label={(k) =>
						k
							.split("/")
							.pop()
							?.replace(/:free$/, "") ?? k
					}
					empty="Nobody asked the assistant in the last 30 days."
				/>
			</div>

			<div className="grid items-stretch gap-4 lg:grid-cols-3">
				<div className="lg:col-span-2">
					<ActivityHeatmap data={data} />
				</div>
				<Panel>
					<PanelHeader
						icon="icon-[hugeicons--building-03]"
						title="Biggest workspaces"
						subtitle="By tasks"
					/>
					<PanelBody className="gap-0 p-0">
						<ul className="divide-y">
							{data.workspaces.slice(0, 6).map((w) => (
								<li key={w.slug} className="grid gap-0.5 px-4 py-2.5">
									<span className="flex items-center gap-2 text-[13px]">
										<span className="grow truncate font-medium">{w.name}</span>
										<span className="font-mono tabular-nums">
											{w.tasks.toLocaleString()}
										</span>
									</span>
									<span className="text-[12px] text-muted-foreground">
										{w.members} {w.members === 1 ? "member" : "members"} ·{" "}
										{w.lastActive
											? `last change ${ago(w.lastActive)}`
											: "no changes yet"}
									</span>
								</li>
							))}
						</ul>
					</PanelBody>
				</Panel>
			</div>
		</div>
	);
}
