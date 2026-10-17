import { useRouterState } from "@tanstack/react-router";
import { PROJECT_PAGE_TABS } from "#/components/shell/nav";
import {
	ListSkeleton,
	Sk,
	TaskViewSkeleton,
	ToolbarSkeleton,
} from "#/components/tasks/skeletons";
import { cn } from "#/lib/utils";

// Each workspace page while its data loads: the page's own title, headings and tabs, with
// placeholders only where data goes. The router shows these in the content area, so you land
// on the page you clicked straight away instead of the old page staying up.

function Head({ title, sub = 300 }: { title?: string; sub?: number }) {
	return (
		<div className="ph">
			<div className="col" style={{ gap: 8 }}>
				{title ? <h1>{title}</h1> : <Sk w={220} h={20} />}
				<Sk w={sub} h={11} />
			</div>
		</div>
	);
}

function Rows({ n = 6, tall }: { n?: number; tall?: boolean }) {
	return Array.from({ length: n }, (_, i) => (
		<div
			// biome-ignore lint/suspicious/noArrayIndexKey: fixed placeholder rows never reorder
			key={i}
			className="row"
			style={{
				minHeight: tall ? 52 : 40,
				borderBottom: "1px solid var(--q-divider)",
				gap: 12,
				padding: "0 14px",
			}}
		>
			<Sk w={tall ? 28 : 15} h={tall ? 28 : 15} r={tall ? "50%" : 4} />
			<div className="grow col" style={{ gap: 6 }}>
				<Sk w={`${40 + ((i * 13) % 35)}%`} h={11} />
				{tall && <Sk w={`${25 + ((i * 7) % 25)}%`} h={9} />}
			</div>
			<Sk w={54} />
		</div>
	));
}

function Panel({ title, n = 5 }: { title: string; n?: number }) {
	return (
		<section className="panel">
			<div className="panel-h">
				<h2>{title}</h2>
			</div>
			<Rows n={n} />
		</section>
	);
}

function Stats({ labels }: { labels: string[] }) {
	return (
		<div className="stats" style={{ marginBottom: 16 }}>
			{labels.map((l) => (
				<div key={l} className="stat">
					<span className="k">{l}</span>
					<Sk w={44} h={22} />
					<Sk w={90} h={9} />
				</div>
			))}
		</div>
	);
}

function Cards({ n = 6 }: { n?: number }) {
	return (
		<div className="pgrid">
			{Array.from({ length: n }, (_, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: fixed placeholder cards never reorder
				<div key={i} className="pcard" style={{ cursor: "default" }}>
					<Sk w={28} h={28} r={7} />
					<Sk w="60%" h={12} />
					<Sk w="90%" h={9} />
					<Sk w="70%" h={9} />
					<Sk w="100%" h={4} />
				</div>
			))}
		</div>
	);
}

const busy = { "aria-busy": true } as const;

export function HomeSkeleton() {
	return (
		<div className="page" {...busy}>
			<Head />
			<Stats
				labels={["Active projects", "Open tasks", "Completed", "Overdue"]}
			/>
			<div className="grid2">
				<div className="stack">
					<Panel title="My tasks" />
					<Panel title="Project progress" n={3} />
				</div>
				<div className="stack">
					<Panel title="Upcoming deadlines" n={4} />
					<Panel title="Recent activity" />
				</div>
			</div>
		</div>
	);
}

export function OverviewSkeleton() {
	return (
		<div className="page" {...busy}>
			<Head title="Workspace overview" sub={200} />
			<Stats labels={["Projects", "Tasks", "Completion rate", "Members"]} />
			<div className="grid2">
				<Panel title="Portfolio" n={6} />
				<div className="stack">
					<Panel title="Tasks by status" n={5} />
					<Panel title="Workload" n={4} />
					<Panel title="Upcoming milestones" n={3} />
				</div>
			</div>
		</div>
	);
}

export function ProjectsSkeleton() {
	return (
		<div className="page wide" {...busy}>
			<Head title="Projects" sub={140} />
			<div className="row" style={{ marginBottom: 16, gap: 8 }}>
				<Sk w={200} h={28} r={7} />
				<Sk w={110} h={26} r={7} />
				<Sk w={150} h={26} r={7} />
			</div>
			<Cards />
		</div>
	);
}

export function ProjectPageSkeleton() {
	const tab = useRouterState({
		select: (s) => (s.location.search as { tab?: string }).tab ?? "board",
	});
	return (
		<div className="page flush" {...busy}>
			<div className="proj-h">
				<div className="t">
					<Sk w={36} h={36} r={9} />
					<Sk w={200} h={20} />
				</div>
				<nav className="tabs" aria-label="Project views">
					{PROJECT_PAGE_TABS.map((t) => (
						<span
							key={t.tab}
							className={cn(
								"tab",
								(tab === t.tab || tab.startsWith(`${t.tab}:`)) && "on",
							)}
						>
							<span className={cn(t.icon, "size-3.5")} aria-hidden="true" />
							{t.label}
						</span>
					))}
				</nav>
			</div>
			{tab === "overview" ? (
				<div className="page" style={{ maxWidth: 1160, paddingTop: 22 }}>
					<div className="grid2">
						<div className="stack">
							<Panel title="About" n={2} />
							<Panel title="Progress" n={2} />
							<Panel title="Coming up" n={4} />
						</div>
						<div className="stack">
							<Panel title="Details" n={6} />
							<Panel title="Milestones" n={2} />
						</div>
					</div>
				</div>
			) : tab === "activity" || tab === "files" ? (
				<div className="page" style={{ maxWidth: 820, paddingTop: 18 }}>
					<Rows n={8} tall />
				</div>
			) : (
				<>
					<ToolbarSkeleton />
					<TaskViewSkeleton type={tab} />
				</>
			)}
		</div>
	);
}

export function InboxSkeleton() {
	return (
		<div className="page flush" {...busy}>
			<div
				style={{
					display: "grid",
					gridTemplateColumns: "minmax(0,420px) minmax(0,1fr)",
					flex: 1,
					minHeight: 0,
				}}
				className="inbox-grid"
			>
				<div style={{ borderRight: "1px solid var(--q-border)" }}>
					<div style={{ padding: "18px var(--q-gutter) 0" }} className="row">
						<h1
							style={{
								fontSize: "var(--q-fs-xl)",
								margin: 0,
								fontWeight: 600,
								letterSpacing: "-.015em",
							}}
						>
							Inbox
						</h1>
					</div>
					<div className="tabs inbox-tabs">
						{["All", "Mentions", "Assignments", "Comments", "Updates"].map(
							(t, i) => (
								<span key={t} className={cn("tab", i === 0 && "on")}>
									{t}
								</span>
							),
						)}
					</div>
					<Rows n={7} tall />
				</div>
				<div className="inbox-prev" />
			</div>
		</div>
	);
}

export function FavoritesSkeleton() {
	return (
		<div className="page wide" {...busy}>
			<Head title="Favorites" sub={280} />
			<h2 className="sec" style={{ marginBottom: 10 }}>
				Projects
			</h2>
			<div style={{ marginBottom: 28 }}>
				<Cards n={3} />
			</div>
			<h2 className="sec" style={{ marginBottom: 6 }}>
				Tasks
			</h2>
			<div className="panel" style={{ overflow: "hidden" }}>
				<Rows n={4} />
			</div>
		</div>
	);
}

export function ArchiveSkeleton() {
	return (
		<div className="page" style={{ maxWidth: 900 }} {...busy}>
			<Head title="Archive" sub={380} />
			<div className="tabs" style={{ marginBottom: 14 }}>
				<span className="tab on">Tasks</span>
				<span className="tab">Projects</span>
			</div>
			<div className="panel" style={{ overflow: "hidden" }}>
				<Rows n={5} tall />
			</div>
		</div>
	);
}

/** Activity and Notifications: a titled feed. */
export function FeedSkeleton({ title }: { title: string }) {
	return (
		<div className="page" style={{ maxWidth: 820 }} {...busy}>
			<Head title={title} sub={260} />
			<div className="panel" style={{ overflow: "hidden" }}>
				<Rows n={8} tall />
			</div>
		</div>
	);
}

export function ActivitySkeleton() {
	return <FeedSkeleton title="Activity" />;
}

export function NotificationsSkeleton() {
	return <FeedSkeleton title="Notifications" />;
}

export function MembersSkeleton() {
	return (
		<div className="page wide" style={{ maxWidth: 1200 }} {...busy}>
			<Head title="Members" sub={180} />
			<div className="panel" style={{ overflow: "hidden" }}>
				<Rows n={8} tall />
			</div>
		</div>
	);
}

export function TeamsSkeleton() {
	return (
		<div className="page" {...busy}>
			<Head title="Teams" sub={220} />
			<Cards n={4} />
		</div>
	);
}

/** A single team or member: their header, then their list. */
export function ProfileSkeleton() {
	return (
		<div className="page" {...busy}>
			<div className="ph">
				<div className="row" style={{ gap: 14 }}>
					<Sk w={48} h={48} r="50%" />
					<div className="col" style={{ gap: 8 }}>
						<Sk w={180} h={20} />
						<Sk w={240} h={11} />
					</div>
				</div>
			</div>
			<div className="panel" style={{ overflow: "hidden" }}>
				<Rows n={6} />
			</div>
		</div>
	);
}

export function SettingsSkeleton() {
	return (
		<div className="page" {...busy}>
			<Head title="Settings" sub={240} />
			<ListSkeleton rows={8} />
		</div>
	);
}
