import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Fragment } from "react";
import { Av } from "#/components/q/av";
import {
	Menu,
	MenuContent,
	MenuItem,
	MenuLabel,
	MenuSeparator,
	MenuTrigger,
} from "#/components/q/menu";
import type { ShellProject, ShellTeam } from "#/graphql/operations";
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
	if (!section) return [{ label: "Home" }];
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
}: {
	slug: string;
	projects: ShellProject[];
	teams: ShellTeam[];
	user: ShellUser;
}) {
	const crumbs = useCrumbs(slug, projects, teams);
	const navigate = useNavigate();
	const { setMnav } = useShell();
	const { openPalette } = useCommandMenu();
	const mod = useModKey();

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
					<Fragment key={c.label}>
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
			<Link
				to="/w/$slug/$"
				params={{ slug, _splat: "notifications" }}
				className="ibtn"
				data-tip="Notifications"
				aria-label="Notifications"
			>
				<span className="icon-[solar--bell-linear] size-4" aria-hidden="true" />
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
					{/* shortcut: task/project/team creation isn't built yet; enable these with those features */}
					<MenuItem
						icon="icon-[solar--check-circle-linear]"
						onSelect={() => {}}
						disabled
						r={<kbd>N</kbd>}
					>
						Task
					</MenuItem>
					<MenuItem
						icon="icon-[solar--folder-with-files-linear]"
						onSelect={() => {}}
						disabled
						r={<kbd>P</kbd>}
					>
						Project
					</MenuItem>
					<MenuItem
						icon="icon-[solar--users-group-rounded-linear]"
						onSelect={() => {}}
						disabled
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
		</header>
	);
}

export function BottomNav({ slug }: { slug: string }) {
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
