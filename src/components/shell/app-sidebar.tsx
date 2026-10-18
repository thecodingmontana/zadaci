import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { type ReactElement, useState } from "react";
import { NotesTree } from "#/components/notes/notes-tree";
import { projectColor } from "#/components/projects/bits";
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
import { WsLogo } from "#/components/q/ws-logo";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "#/components/ui/tooltip";
import type {
	ShellProject,
	ShellTeam,
	WorkspaceSummary,
} from "#/graphql/operations";
import { setAppearance, useAppearance } from "#/lib/appearance";
import { authClient } from "#/lib/auth-client";
import { can, type Permission } from "#/lib/permissions";
import { pstat } from "#/lib/projects";
import { copy } from "#/lib/toast";
import { cn } from "#/lib/utils";
import { useCommandMenu, useModKey } from "./command-menu";
import {
	CreditsModal,
	REPO_URL,
	SUPPORT_EMAIL,
	supportMailto,
} from "./credits";
import {
	ARCHIVE_NAV,
	MAIN_NAV,
	type NavItem,
	PROJECT_TABS,
	SETTINGS_NAV,
	WORKSPACE_NAV,
} from "./nav";
import { ProjectMenu } from "./project-menu";
import { useShell } from "./shell-state";

// Sidebar ported from the reference app's renderSidebar (shell.js) and shell.css.

export type ShellUser = { name: string; email: string; image?: string | null };

function useActive(slug: string) {
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	return (path: string) => {
		const href = path ? `/w/${slug}/${path}` : `/w/${slug}`;
		return path
			? pathname === href || pathname.startsWith(`${href}/`)
			: pathname === href || pathname === `${href}/`;
	};
}

/** shadcn tooltip to the right of a sidebar item, only while the sidebar is collapsed to icons. */
function SideTip({
	label,
	children,
	always,
}: {
	label: string;
	children: ReactElement;
	always?: boolean;
}) {
	const { collapsed } = useShell();
	if (!collapsed && !always) return children;
	return (
		<Tooltip>
			<TooltipTrigger asChild>{children}</TooltipTrigger>
			<TooltipContent
				side={collapsed ? "right" : "bottom"}
				sideOffset={6}
				className="max-[900px]:hidden"
			>
				{label}
			</TooltipContent>
		</Tooltip>
	);
}

function SItem({
	slug,
	item,
	on,
	ct,
	dot,
}: {
	slug: string;
	item: NavItem;
	on: boolean;
	ct?: number;
	dot?: boolean;
}) {
	const props = {
		className: cn("sitem", on && "on"),
		"aria-current": on ? ("page" as const) : undefined,
	};
	const body = (
		<>
			<span className={cn(item.icon, "i size-4 shrink-0")} aria-hidden="true" />
			<span className="trunc">{item.label}</span>
			{!!ct && <span className={cn("ct", dot && "dotc")}>{ct}</span>}
		</>
	);
	const link =
		item.path === "settings" ? (
			<Link to="/w/$slug/settings" params={{ slug }} {...props}>
				{body}
			</Link>
		) : item.path ? (
			<Link to="/w/$slug/$" params={{ slug, _splat: item.path }} {...props}>
				{body}
			</Link>
		) : (
			<Link to="/w/$slug" params={{ slug }} {...props}>
				{body}
			</Link>
		);
	return <SideTip label={item.label}>{link}</SideTip>;
}

export function UserMenuContent({
	user,
	slug,
}: {
	user: ShellUser;
	slug: string;
}) {
	const navigate = useNavigate();
	const { openShortcuts } = useCommandMenu();
	const { theme } = useAppearance();
	return (
		<MenuContent width={260} align="start">
			<div className="row" style={{ padding: "8px 8px 10px", gap: 10 }}>
				<Av name={user.name} image={user.image} className="lg" />
				<div style={{ minWidth: 0 }}>
					<div style={{ fontWeight: 600 }}>{user.name}</div>
					<div className="faint trunc" style={{ fontSize: 12 }}>
						{user.email}
					</div>
				</div>
			</div>
			<MenuSeparator />
			<MenuItem
				icon="icon-[solar--settings-linear]"
				onSelect={() =>
					navigate({
						to: "/w/$slug/settings",
						params: { slug },
						search: { sec: "profile" },
					})
				}
			>
				Account settings
			</MenuItem>
			<MenuSeparator />
			<MenuLabel>Theme</MenuLabel>
			<div style={{ padding: "2px 6px 6px" }}>
				<div className="seg" style={{ width: "100%" }}>
					{(
						[
							["light", "icon-[solar--sun-2-linear]", "Light"],
							["dark", "icon-[solar--moon-linear]", "Dark"],
							["system", "icon-[solar--monitor-linear]", "System"],
						] as const
					).map(([k, icon, n]) => (
						<button
							key={k}
							type="button"
							className={theme === k ? "on" : ""}
							aria-pressed={theme === k}
							style={{ flex: 1, justifyContent: "center" }}
							onClick={() => setAppearance({ theme: k })}
						>
							<span className={cn(icon, "size-[13px]")} aria-hidden="true" />
							{n}
						</button>
					))}
				</div>
			</div>
			<MenuSeparator />
			<MenuItem
				icon="icon-[solar--keyboard-linear]"
				onSelect={openShortcuts}
				r={<kbd>?</kbd>}
			>
				Keyboard shortcuts
			</MenuItem>
			<MenuItem
				icon="icon-[solar--logout-2-linear]"
				onSelect={async () => {
					await authClient.signOut();
					navigate({ to: "/auth/signin" });
				}}
			>
				Sign out
			</MenuItem>
		</MenuContent>
	);
}

export function AppSidebar({
	workspace,
	workspaces,
	projects,
	teams,
	user,
	unread,
}: {
	workspace: WorkspaceSummary;
	workspaces: WorkspaceSummary[];
	projects: ShellProject[];
	teams: ShellTeam[];
	user: ShellUser;
	unread: { all: number; inbox: number; myTasks: number; archive: number };
}) {
	const slug = workspace.slug;
	const navigate = useNavigate();
	const allowed = (p: Permission) => can(workspace.role, p, workspace.settings);
	const [creatingProject, setCreatingProject] = useState(false);
	const [showCredits, setShowCredits] = useState(false);
	const isActive = useActive(slug);
	const { collapsed, toggleSide } = useShell();
	const { openPalette, openShortcuts } = useCommandMenu();
	const mod = useModKey();
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const [expanded, setExpanded] = useState<Record<string, boolean>>({});

	return (
		<nav className="side" aria-label="Main">
			<div className="side-top">
				<div className="row" style={{ gap: 2 }}>
					<Menu>
						<MenuTrigger className="ws grow" aria-label="Switch workspace">
							<WsLogo workspace={workspace} px={22} />
							<span className="ws-name trunc">{workspace.name}</span>
							<span
								className="chev-d faint icon-[solar--sort-vertical-linear] size-[13px] shrink-0"
								aria-hidden="true"
							/>
						</MenuTrigger>
						<MenuContent width={260} align="start">
							<MenuLabel>Workspaces</MenuLabel>
							{workspaces.map((w) => (
								<MenuItem
									key={w.id}
									checked={w.id === workspace.id}
									onSelect={() =>
										navigate({ to: "/w/$slug", params: { slug: w.slug } })
									}
								>
									<WsLogo workspace={w} px={20} />
									<span className="grow trunc">{w.name}</span>
									<span className="faint" style={{ fontSize: 11 }}>
										{w.role === "moderator"
											? "Admin"
											: `${w.role[0]?.toUpperCase()}${w.role.slice(1)}`}
									</span>
								</MenuItem>
							))}
							<MenuSeparator />
							<MenuItem
								icon="icon-[hugeicons--plus-sign]"
								onSelect={() => navigate({ to: "/onboarding" })}
							>
								Create workspace
							</MenuItem>
							<MenuItem
								icon="icon-[solar--settings-linear]"
								onSelect={() =>
									navigate({
										to: "/w/$slug/settings",
										params: { slug },
										search: { sec: "workspace" },
									})
								}
							>
								Workspace settings
							</MenuItem>
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
								Invite members
							</MenuItem>
							<MenuSeparator />
							<MenuItem
								icon="icon-[solar--logout-2-linear]"
								onSelect={async () => {
									await authClient.signOut();
									navigate({ to: "/auth/signin" });
								}}
							>
								Sign out
							</MenuItem>
						</MenuContent>
					</Menu>
					{!collapsed && (
						<SideTip label="Collapse sidebar  [" always>
							<button
								type="button"
								className="ibtn ibtn-sm hide-m"
								onClick={toggleSide}
								aria-label="Collapse sidebar"
							>
								<span
									className="icon-[solar--sidebar-minimalistic-linear] size-[15px]"
									aria-hidden="true"
								/>
							</button>
						</SideTip>
					)}
				</div>
			</div>

			<div className="side-scroll">
				{collapsed && (
					<SideTip label="Expand sidebar">
						<button
							type="button"
							className="sitem side-expand"
							onClick={toggleSide}
							aria-label="Expand sidebar"
						>
							<span
								className="i icon-[solar--sidebar-minimalistic-linear] size-4"
								aria-hidden="true"
							/>
						</button>
					</SideTip>
				)}
				{MAIN_NAV.map((item) => (
					<SItem
						key={item.path}
						slug={slug}
						item={item}
						on={isActive(item.path)}
						ct={
							item.path === "inbox"
								? unread.inbox
								: item.path === "notifications"
									? unread.all
									: item.path === "my-tasks"
										? unread.myTasks
										: undefined
						}
						dot={item.path === "inbox"}
					/>
				))}

				<div className="sgroup">
					<div className="sgroup-h">Workspace</div>
					{WORKSPACE_NAV.map((item) => (
						<SItem
							key={item.path}
							slug={slug}
							item={item}
							on={isActive(item.path)}
						/>
					))}
				</div>

				<div className="sgroup" id="side-projects">
					<div className="sgroup-h">
						<span>Projects</span>
						<span className="sp" />
						{allowed("createProjects") && (
							<SideTip label="New project" always>
								<button
									type="button"
									className="ibtn ibtn-xs"
									aria-label="New project"
									onClick={() => setCreatingProject(true)}
								>
									<span
										className="icon-[hugeicons--plus-sign] size-3.5"
										aria-hidden="true"
									/>
								</button>
							</SideTip>
						)}
					</div>
					{projects.map((p, index) => {
						const base = `/w/${slug}/p/${p.id}`;
						const on = pathname === base || pathname.startsWith(`${base}/`);
						const open = expanded[p.id] ?? false;
						const color = projectColor(p.color);
						return (
							<div key={p.id} className="sproj">
								<div className={cn("sitem", on && "on")}>
									<SideTip label={p.title}>
										<Link
											to="/w/$slug/p/$projectId"
											params={{ slug, projectId: p.id }}
											className="row grow"
											style={{ gap: 9, height: "100%" }}
											aria-current={on ? "page" : undefined}
										>
											<span
												className="pico"
												style={{ "--c": color } as React.CSSProperties}
											>
												<span
													className={cn(
														p.icon ?? "icon-[solar--folder-linear]",
														"i size-3",
													)}
													aria-hidden="true"
												/>
											</span>
											<span className="trunc">{p.title}</span>
											{p.isFavorite && (
												<span className="fav" role="img" aria-label="Favorite">
													<span
														className="icon-[solar--star-linear] size-[11px]"
														aria-hidden="true"
													/>
												</span>
											)}
											{p.access === "private" && (
												<span
													className="faint"
													style={{ marginLeft: 4, display: "inline-flex" }}
													role="img"
													aria-label="Private"
												>
													<span
														className="icon-[solar--lock-keyhole-linear] size-[11px]"
														aria-hidden="true"
													/>
												</span>
											)}
										</Link>
									</SideTip>
									<span
										className="sdot"
										style={{ background: pstat(p.status).c }}
										title={pstat(p.status).name}
									/>
									<span className="hov">
										<ProjectMenu
											slug={slug}
											project={p}
											index={index}
											count={projects.length}
											allowed={allowed}
										/>
										<button
											type="button"
											className="ibtn ibtn-xs"
											aria-label={
												open ? `Collapse ${p.title}` : `Expand ${p.title}`
											}
											aria-expanded={open}
											onClick={() => {
												setExpanded((x) => ({ ...x, [p.id]: !open }));
											}}
										>
											<span
												className={cn(
													"chev icon-[solar--alt-arrow-right-linear] size-[13px]",
													open && "open",
												)}
												aria-hidden="true"
											/>
										</button>
									</span>
								</div>
								<div className={cn("sub", open && "open")}>
									{PROJECT_TABS.map(({ tab, label, icon }) => (
										<Link
											key={tab}
											to="/w/$slug/p/$projectId"
											params={{ slug, projectId: p.id }}
											search={{ tab }}
											activeOptions={{ includeSearch: true }}
											activeProps={{ className: "on" }}
											className="sitem"
										>
											<span
												className={cn(icon, "i size-3.5 shrink-0")}
												aria-hidden="true"
											/>
											<span>{label}</span>
										</Link>
									))}
								</div>
							</div>
						);
					})}
					<SItem
						slug={slug}
						item={ARCHIVE_NAV}
						on={isActive(ARCHIVE_NAV.path)}
						ct={unread.archive}
					/>
				</div>

				{!collapsed && <NotesTree slug={slug} />}

				{teams.length > 0 && (
					<div className="sgroup">
						<div className="sgroup-h">
							<span>Teams</span>
						</div>
						{teams.map((t) => (
							<SItem
								key={t.id}
								slug={slug}
								item={{
									path: `teams/${t.id}`,
									label: t.name,
									icon: t.icon ?? "icon-[solar--users-group-rounded-linear]",
								}}
								on={isActive(`teams/${t.id}`)}
							/>
						))}
					</div>
				)}
			</div>

			<div className="side-bot">
				<Menu>
					<SideTip label="Help & resources">
						<MenuTrigger className="sitem">
							<span
								className="i icon-[solar--question-circle-linear] size-4 shrink-0"
								aria-hidden="true"
							/>
							<span>Help & resources</span>
						</MenuTrigger>
					</SideTip>
					<MenuContent width={260} align="start">
						<MenuLabel>Help & resources</MenuLabel>
						<MenuItem
							icon="icon-[solar--keyboard-linear]"
							onSelect={openShortcuts}
							r={<kbd>?</kbd>}
						>
							Keyboard shortcuts
						</MenuItem>
						<MenuItem
							icon="icon-[solar--command-linear]"
							onSelect={openPalette}
							r={<kbd>{mod}K</kbd>}
						>
							Command menu
						</MenuItem>
						<MenuSeparator />
						<MenuLabel>Support</MenuLabel>
						<MenuItem
							icon="icon-[hugeicons--mail-01]"
							onSelect={() => {
								window.location.href = supportMailto();
							}}
							r={
								<span className="faint" style={{ fontSize: 11 }}>
									Email
								</span>
							}
						>
							Contact support
						</MenuItem>
						<MenuItem
							icon="icon-[solar--copy-linear]"
							onSelect={() => copy(SUPPORT_EMAIL, "support email")}
						>
							Copy support email
						</MenuItem>
						<MenuItem
							icon="icon-[hugeicons--github]"
							onSelect={() =>
								window.open(REPO_URL, "_blank", "noopener,noreferrer")
							}
							r={
								<span
									className="icon-[solar--arrow-right-up-linear] size-3 faint"
									aria-hidden="true"
								/>
							}
						>
							Source code on GitHub
						</MenuItem>
						<MenuItem
							icon="icon-[hugeicons--favourite]"
							onSelect={() => setShowCredits(true)}
						>
							Credits
						</MenuItem>
					</MenuContent>
				</Menu>
				<SItem
					slug={slug}
					item={SETTINGS_NAV}
					on={isActive(SETTINGS_NAV.path)}
				/>
				<Menu>
					<SideTip label="Account">
						<MenuTrigger
							className="sitem"
							style={{ height: 36 }}
							aria-label="Account menu"
						>
							<Av name={user.name} image={user.image} />
							<span
								className="trunc"
								style={{ color: "var(--q-text)", fontWeight: 500 }}
							>
								{user.name}
							</span>
							<span className="ct">
								<span
									className="icon-[solar--sort-vertical-linear] size-[13px]"
									aria-hidden="true"
								/>
							</span>
						</MenuTrigger>
					</SideTip>
					<UserMenuContent user={user} slug={slug} />
				</Menu>
			</div>
			<CreditsModal open={showCredits} onOpenChange={setShowCredits} />
			<ProjectModalLoader
				open={creatingProject}
				onOpenChange={setCreatingProject}
				slug={slug}
			/>
		</nav>
	);
}

/** The sidebar while a workspace loads: real links, placeholders for its name and projects. */
export function SidebarSkeleton({
	slug,
	user,
}: {
	slug: string;
	user: ShellUser;
}) {
	return (
		<nav className="side" aria-label="Main" aria-busy="true">
			<div className="side-top">
				<div className="ws grow" style={{ cursor: "default" }}>
					<span
						className="sk"
						style={{ width: 22, height: 22, borderRadius: 6 }}
					/>
					<span className="sk" style={{ width: 96, height: 11 }} />
				</div>
			</div>
			<div className="side-scroll">
				{MAIN_NAV.map((item) => (
					<SItem key={item.path} slug={slug} item={item} on={false} />
				))}
				<div className="sgroup">
					<div className="sgroup-h">Workspace</div>
					{WORKSPACE_NAV.map((item) => (
						<SItem key={item.path} slug={slug} item={item} on={false} />
					))}
				</div>
				<div className="sgroup">
					<div className="sgroup-h">Projects</div>
					{[62, 48, 70].map((w) => (
						<div key={w} className="sitem" style={{ cursor: "default" }}>
							<span
								className="sk"
								style={{ width: 16, height: 16, borderRadius: 4 }}
							/>
							<span className="sk" style={{ width: `${w}%`, height: 10 }} />
						</div>
					))}
				</div>
			</div>
			<div className="side-bot">
				<SItem slug={slug} item={SETTINGS_NAV} on={false} />
				<div className="sitem" style={{ height: 36, cursor: "default" }}>
					<Av name={user.name} image={user.image} />
					<span
						className="trunc"
						style={{ color: "var(--q-text)", fontWeight: 500 }}
					>
						{user.name}
					</span>
				</div>
			</div>
		</nav>
	);
}
