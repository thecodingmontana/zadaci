import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
	AdminHeader,
	EmptyPanel,
	Panel,
	PanelHeader,
	StatTile,
} from "#/components/admin/primitives";
import { getAdminDirectory } from "#/lib/session";
import { ago } from "#/lib/time";
import { cn } from "#/lib/utils";

// Admin Directory: everyone who signed up and every workspace, searchable.

export const Route = createFileRoute("/_authed/admin/directory")({
	loader: () => getAdminDirectory(),
	component: AdminDirectoryPage,
});

const METHOD_LABEL: Record<string, string> = {
	credential: "Password",
	google: "Google",
	"magic-link": "Email link",
	passkey: "Passkey",
};
const WEEK = 7 * 86_400_000;
const day = (iso: string) =>
	new Date(iso).toLocaleDateString(undefined, {
		day: "numeric",
		month: "short",
		year: "numeric",
	});

function AdminDirectoryPage() {
	const data = Route.useLoaderData();
	const [tab, setTab] = useState<"people" | "workspaces">("people");
	const [q, setQ] = useState("");
	const term = q.trim().toLowerCase();
	const people = data.people.filter(
		(p) =>
			!term ||
			p.name.toLowerCase().includes(term) ||
			p.email.toLowerCase().includes(term),
	);
	const workspaces = data.workspaces.filter(
		(w) =>
			!term ||
			w.name.toLowerCase().includes(term) ||
			w.slug.toLowerCase().includes(term),
	);
	const recent = (iso: string | null) =>
		!!iso && Date.now() - new Date(iso).getTime() < WEEK;

	return (
		<div className="grid gap-5 p-5">
			<AdminHeader
				title="Directory"
				subtitle="Everyone who signed up and every workspace, newest first."
			/>

			<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
				<StatTile
					icon="icon-[hugeicons--user-multiple]"
					label="People"
					value={data.people.length}
					note={`${data.people.filter((p) => recent(p.joined)).length} joined this week`}
				/>
				<StatTile
					icon="icon-[hugeicons--user-check-01]"
					label="Seen this week"
					value={data.people.filter((p) => recent(p.lastSeen)).length}
					note="used Zadaci in the last 7 days"
				/>
				<StatTile
					icon="icon-[hugeicons--shield-user]"
					label="Two-step on"
					value={data.people.filter((p) => p.twoFactor).length}
					note={`of ${data.people.length} people`}
				/>
				<StatTile
					icon="icon-[hugeicons--building-03]"
					label="Workspaces"
					value={data.workspaces.length}
					note={`${data.workspaces.filter((w) => recent(w.lastActive)).length} changed this week`}
				/>
			</div>

			<Panel>
				<PanelHeader
					icon={
						tab === "people"
							? "icon-[hugeicons--user-multiple]"
							: "icon-[hugeicons--building-03]"
					}
					title={tab === "people" ? "People" : "Workspaces"}
					subtitle={
						tab === "people"
							? "Name, email, how they sign in and when they were last seen"
							: "Members, projects, tasks and the last change"
					}
					action={
						<div className="flex flex-wrap items-center gap-2">
							<div className="flex gap-1">
								{(["people", "workspaces"] as const).map((t) => (
									<button
										key={t}
										type="button"
										className={cn(
											"btn btn-sm",
											tab === t ? "btn-secondary" : "btn-ghost",
										)}
										aria-pressed={tab === t}
										onClick={() => setTab(t)}
									>
										{t === "people" ? "People" : "Workspaces"}
									</button>
								))}
							</div>
							<input
								className="input h-[26px] w-48 text-[12.5px]"
								type="search"
								placeholder={
									tab === "people" ? "Search name or email" : "Search name"
								}
								aria-label="Search the directory"
								value={q}
								onChange={(e) => setQ(e.target.value)}
							/>
						</div>
					}
				/>
				<div className="overflow-x-auto">
					{tab === "people" ? (
						people.length ? (
							<table className="w-full min-w-[640px] text-[13px]">
								<thead className="text-left text-[12px] text-muted-foreground">
									<tr className="border-b">
										<th className="px-4 py-2 font-normal">Person</th>
										<th className="px-4 py-2 font-normal">Signs in with</th>
										<th className="px-4 py-2 text-right font-normal">
											Workspaces
										</th>
										<th className="px-4 py-2 font-normal">Joined</th>
										<th className="px-4 py-2 font-normal">Last seen</th>
									</tr>
								</thead>
								<tbody className="divide-y">
									{people.map((p) => (
										<tr key={p.id}>
											<td className="px-4 py-2.5">
												<div className="font-medium">{p.name}</div>
												<div className="text-[12px] text-muted-foreground">
													{p.email}
												</div>
											</td>
											<td className="px-4 py-2.5">
												{p.methods
													.map((m) => METHOD_LABEL[m] ?? m)
													.join(", ") || "—"}
												{p.twoFactor && (
													<span className="ml-1.5 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[11px] text-emerald-600 dark:text-emerald-400">
														2-step
													</span>
												)}
											</td>
											<td className="px-4 py-2.5 text-right font-mono tabular-nums">
												{p.workspaces}
											</td>
											<td className="px-4 py-2.5 text-muted-foreground">
												{day(p.joined)}
											</td>
											<td className="px-4 py-2.5 text-muted-foreground">
												{p.lastSeen ? ago(p.lastSeen) : "Never"}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						) : (
							<EmptyPanel
								icon="icon-[hugeicons--search-01]"
								message="Nobody matches that."
							/>
						)
					) : workspaces.length ? (
						<table className="w-full min-w-[640px] text-[13px]">
							<thead className="text-left text-[12px] text-muted-foreground">
								<tr className="border-b">
									<th className="px-4 py-2 font-normal">Workspace</th>
									<th className="px-4 py-2 text-right font-normal">Members</th>
									<th className="px-4 py-2 text-right font-normal">Projects</th>
									<th className="px-4 py-2 text-right font-normal">Tasks</th>
									<th className="px-4 py-2 font-normal">Created</th>
									<th className="px-4 py-2 font-normal">Last change</th>
								</tr>
							</thead>
							<tbody className="divide-y">
								{workspaces.map((w) => (
									<tr key={w.id}>
										<td className="px-4 py-2.5">
											<div className="font-medium">{w.name}</div>
											<div className="text-[12px] text-muted-foreground">
												{w.slug}
											</div>
										</td>
										<td className="px-4 py-2.5 text-right font-mono tabular-nums">
											{w.members}
										</td>
										<td className="px-4 py-2.5 text-right font-mono tabular-nums">
											{w.projects}
										</td>
										<td className="px-4 py-2.5 text-right font-mono tabular-nums">
											{w.tasks}
										</td>
										<td className="px-4 py-2.5 text-muted-foreground">
											{day(w.created)}
										</td>
										<td className="px-4 py-2.5 text-muted-foreground">
											{w.lastActive ? ago(w.lastActive) : "Never"}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					) : (
						<EmptyPanel
							icon="icon-[hugeicons--search-01]"
							message="No workspace matches that."
						/>
					)}
				</div>
			</Panel>
		</div>
	);
}
