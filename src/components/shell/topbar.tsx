import { useQuery } from "@apollo/client/react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Fragment, useState } from "react";
import { useAssistant } from "#/components/ai/assistant-panel";
import { noteTitle } from "#/components/notes/notes-tree";
import { ProjectModalLoader } from "#/components/projects/project-modal";
import { Av } from "#/components/q/av";
import {
	Menu,
	MenuContent,
	MenuItem,
	MenuLabel,
	MenuSeparator,
	MenuTrigger,
} from "#/components/q/menu";
import { useCanCreateTask, useNewTask } from "#/components/tasks/new-task";
import { NOTES } from "#/graphql/note-operations";
import type { ShellProject, ShellTeam } from "#/graphql/operations";
import { ancestors } from "#/lib/note-tree";
import { cn } from "#/lib/utils";
import { type ShellUser, UserMenuContent } from "./app-sidebar";
import { useCommandMenu, useModKey } from "./command-menu";
import { BOTTOM_NAV, navItem } from "./nav";
import { useShell } from "./shell-state";

// Top bar and mobile bottom nav ported from the reference app's renderTopbar / renderBottomNav.

type Crumb = { label: string; path?: string };

function useCrumbs(
	slug: string,
	projects: ShellProject[],
	teams: ShellTeam[],
): Crumb[] {
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const [section, id] = pathname
		.replace(`/w/${slug}`, "")
		.split("/")
		.filter(Boolean);
	// a note's trail: Notes / the pages above it / the page (the page loader filled the cache)
	const notes =
		useQuery(NOTES, {
			variables: { slug },
			skip: section !== "notes" || !id,
		}).data?.notes ?? [];
	if (!section) return [{ label: "Home" }];
	if (section === "notes" && id) {
		const note = notes.find((n) => n.id === id);
		return [
			{ label: "Notes" },
			...ancestors(notes, id).map((n) => ({
				label: noteTitle(n),
				path: `notes/${n.id}`,
			})),
			{ label: note ? noteTitle(note) : "Note" },
		];
	}
	if (section === "p") {
		return [
			{ label: "Projects", path: "projects" },
			{ label: projects.find((p) => p.id === id)?.title ?? "Project" },
		];
	}
	if (section === "teams" && id) {
		return [
			{ label: "Teams", path: "teams" },
			{ label: teams.find((t) => t.id === id)?.name ?? "Team" },
		];
	}
	return [{ label: navItem(section)?.label ?? "Not found" }];
}

export function Topbar({
	slug,
	projects,
	teams,
	user,
	unread,
	canCreateProjects,
}: {
	slug: string;
	projects: ShellProject[];
	teams: ShellTeam[];
	user: ShellUser;
	unread: number;
	canCreateProjects: boolean;
}) {
	const crumbs = useCrumbs(slug, projects, teams);
	const [creatingProject, setCreatingProject] = useState(false);
	const newTask = useNewTask();
	const canCreateTask = useCanCreateTask();
	const navigate = useNavigate();
	const { setMnav } = useShell();
	const { openPalette } = useCommandMenu();
	const mod = useModKey();
	const assistant = useAssistant();

	return (
		<header className="topbar">
			<button
				type="button"
				className="ibtn min-[901px]:hidden!"
				onClick={() => setMnav(true)}
				aria-label="Open navigation"
			>
				<span
					className="icon-[solar--hamburger-menu-linear] size-[17px]"
					aria-hidden="true"
				/>
			</button>
			<nav className="crumbs trunc" aria-label="Breadcrumb">
				{crumbs.map((c, i) => (
					<Fragment key={c.path ?? `${i}-${c.label}`}>
						{i > 0 && <span className="sep">/</span>}
						{c.path ? (
							<Link to="/w/$slug/$" params={{ slug, _splat: c.path }}>
								{c.label}
							</Link>
						) : (
							<span className="cur" aria-current="page">
								{c.label}
							</span>
						)}
					</Fragment>
				))}
			</nav>
			<span className="sp" />
			{/* pages put their own actions here (a note's save status and menu) */}
			<div id="topbar-page" className="row" style={{ gap: 6 }} />
			<button
				type="button"
				className="topsearch"
				onClick={openPalette}
				aria-label="Search and commands"
			>
				<span
					className="icon-[solar--magnifer-linear] size-3.5 shrink-0"
					aria-hidden="true"
				/>
				<span className="lbltxt">Search or jump to…</span>
				<span className="kbd">{mod}K</span>
			</button>
			<button
				type="button"
				className={cn("ibtn", assistant.open && "on")}
				data-tip={`Assistant (${mod}J)`}
				aria-label="Assistant"
				aria-pressed={assistant.open}
				onClick={assistant.toggle}
			>
				<span
					className="icon-[hugeicons--ai-magic] size-4"
					aria-hidden="true"
				/>
			</button>
			<Link
				to="/w/$slug/$"
				params={{ slug, _splat: "notifications" }}
				className="ibtn"
				data-tip="Notifications"
				aria-label="Notifications"
			>
				<span className="icon-[solar--bell-linear] size-4" aria-hidden="true" />
				{unread > 0 && (
					<span
						style={{
							position: "absolute",
							top: 6,
							right: 7,
							width: 7,
							height: 7,
							borderRadius: "50%",
							background: "var(--q-accent)",
							boxShadow: "0 0 0 2px var(--q-surface)",
						}}
					/>
				)}
			</Link>
			<Menu>
				<MenuTrigger
					className="btn btn-secondary btn-sm"
					aria-label="Create new"
				>
					<span
						className="icon-[hugeicons--plus-sign] size-3.5"
						aria-hidden="true"
					/>
					<span className="hide-m">New</span>
					<span
						className="hide-m icon-[solar--alt-arrow-down-linear] size-3"
						aria-hidden="true"
					/>
				</MenuTrigger>
				<MenuContent width={220}>
					<MenuLabel>Create</MenuLabel>
					<MenuItem
						icon="icon-[solar--check-circle-linear]"
						onSelect={() => newTask()}
						disabled={!canCreateTask}
					>
						Task
					</MenuItem>
					<MenuItem
						icon="icon-[solar--folder-with-files-linear]"
						onSelect={() => setCreatingProject(true)}
						disabled={!canCreateProjects}
					>
						Project
					</MenuItem>
					<MenuItem
						icon="icon-[solar--users-group-rounded-linear]"
						onSelect={() =>
							navigate({ to: "/w/$slug/teams", params: { slug } })
						}
					>
						Team
					</MenuItem>
					<MenuSeparator />
					<MenuItem
						icon="icon-[solar--user-plus-linear]"
						onSelect={() =>
							navigate({
								to: "/w/$slug/settings",
								params: { slug },
								search: { sec: "members" },
							})
						}
					>
						Invite member
					</MenuItem>
				</MenuContent>
			</Menu>
			<Menu>
				<MenuTrigger
					className="ibtn hide-m"
					aria-label="Account menu"
					style={{ width: "auto", padding: "0 2px" }}
				>
					<Av name={user.name} image={user.image} className="md" />
				</MenuTrigger>
				<UserMenuContent user={user} slug={slug} />
			</Menu>
			<ProjectModalLoader
				open={creatingProject}
				onOpenChange={setCreatingProject}
				slug={slug}
			/>
		</header>
	);
}

export function BottomNav({ slug, unread }: { slug: string; unread: number }) {
	const { setMnav } = useShell();
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	return (
		<nav className="bottomnav" aria-label="Primary">
			{BOTTOM_NAV.map((nav) => {
				const href = nav.path ? `/w/${slug}/${nav.path}` : `/w/${slug}`;
				const on = nav.path ? pathname.startsWith(href) : pathname === href;
				const body = (
					<>
						<span className={cn(nav.icon, "size-[19px]")} aria-hidden="true" />
						<span>{nav.label}</span>
						{nav.path === "inbox" && unread > 0 && <span className="bdot" />}
					</>
				);
				return nav.path ? (
					<Link
						key={nav.path}
						to="/w/$slug/$"
						params={{ slug, _splat: nav.path }}
						className={on ? "on" : ""}
						aria-current={on ? "page" : undefined}
					>
						{body}
					</Link>
				) : (
					<Link
						key="home"
						to="/w/$slug"
						params={{ slug }}
						className={on ? "on" : ""}
						aria-current={on ? "page" : undefined}
					>
						{body}
					</Link>
				);
			})}
			<button type="button" onClick={() => setMnav(true)}>
				<span
					className="icon-[solar--menu-dots-bold] size-[19px]"
					aria-hidden="true"
				/>
				<span>More</span>
			</button>
		</nav>
	);
}
