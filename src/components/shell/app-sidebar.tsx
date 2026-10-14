import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "#/components/ui/avatar";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "#/components/ui/collapsible";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuShortcut,
	DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupAction,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuAction,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
	SidebarRail,
	useSidebar,
} from "#/components/ui/sidebar";
import type {
	ShellProject,
	ShellTeam,
	WorkspaceSummary,
} from "#/graphql/operations";
import { authClient } from "#/lib/auth-client";
import { toast } from "#/lib/toast";
import { cn } from "#/lib/utils";
import { useCommandMenu, useModKey } from "./command-menu";
import {
	ARCHIVE_NAV,
	MAIN_NAV,
	type NavItem,
	PROJECT_TABS,
	SETTINGS_NAV,
	WORKSPACE_NAV,
} from "./nav";

export type ShellUser = { name: string; email: string; image?: string | null };

export function initials(name: string) {
	return (
		name
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((word) => word[0]?.toUpperCase())
			.join("") || "?"
	);
}

export function WorkspaceLogo({
	workspace,
	className,
}: {
	workspace: Pick<WorkspaceSummary, "name" | "imageUrl">;
	className?: string;
}) {
	return (
		<Avatar className={cn("size-6 rounded-md", className)}>
			{workspace.imageUrl && <AvatarImage src={workspace.imageUrl} alt="" />}
			<AvatarFallback className="rounded-md bg-brand text-[10px] font-semibold text-white">
				{initials(workspace.name)}
			</AvatarFallback>
		</Avatar>
	);
}

export function UserAvatar({
	user,
	className,
}: {
	user: ShellUser;
	className?: string;
}) {
	return (
		<Avatar className={cn("size-6", className)}>
			{user.image && (
				<AvatarImage src={user.image} alt="" referrerPolicy="no-referrer" />
			)}
			<AvatarFallback className="bg-muted text-[10px] font-semibold">
				{initials(user.name)}
			</AvatarFallback>
		</Avatar>
	);
}

/** Active when the current path is this item's path or below it ("" = workspace home, exact only). */
function useIsActive(slug: string) {
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	return (path: string) => {
		const href = path ? `/w/${slug}/${path}` : `/w/${slug}`;
		return path
			? pathname === href || pathname.startsWith(`${href}/`)
			: pathname === href || pathname === `${href}/`;
	};
}

function NavLink({
	slug,
	item,
	active,
}: {
	slug: string;
	item: NavItem;
	active: boolean;
}) {
	return (
		<SidebarMenuItem>
			<SidebarMenuButton asChild isActive={active} tooltip={item.label}>
				{item.path ? (
					<Link to="/w/$slug/$" params={{ slug, _splat: item.path }}>
						<span className={cn(item.icon, "size-4")} aria-hidden="true" />
						<span>{item.label}</span>
					</Link>
				) : (
					<Link to="/w/$slug" params={{ slug }}>
						<span className={cn(item.icon, "size-4")} aria-hidden="true" />
						<span>{item.label}</span>
					</Link>
				)}
			</SidebarMenuButton>
		</SidebarMenuItem>
	);
}

export function UserMenuItems({ user }: { user: ShellUser }) {
	const navigate = useNavigate();
	return (
		<>
			<DropdownMenuLabel className="flex flex-col gap-0.5 font-normal">
				<span className="truncate font-medium">{user.name}</span>
				<span className="truncate text-xs text-muted-foreground">
					{user.email}
				</span>
			</DropdownMenuLabel>
			<DropdownMenuSeparator />
			<DropdownMenuItem
				onSelect={async () => {
					const { error } = await authClient.passkey.addPasskey();
					if (!error) toast.success("Passkey added");
					else if (
						!(
							"code" in error &&
							["AUTH_CANCELLED", "ERROR_CEREMONY_ABORTED"].includes(error.code)
						)
					)
						toast.error("Couldn't add a passkey", { desc: error.message });
				}}
			>
				<span
					className="icon-[solar--key-minimalistic-linear] size-4"
					aria-hidden="true"
				/>
				Add a passkey
			</DropdownMenuItem>
			<DropdownMenuSeparator />
			<DropdownMenuItem
				onSelect={async () => {
					await authClient.signOut();
					navigate({ to: "/auth/signin" });
				}}
			>
				<span
					className="icon-[solar--logout-2-linear] size-4"
					aria-hidden="true"
				/>
				Sign out
			</DropdownMenuItem>
		</>
	);
}

export function AppSidebar({
	workspace,
	workspaces,
	projects,
	teams,
	user,
}: {
	workspace: WorkspaceSummary;
	workspaces: WorkspaceSummary[];
	projects: ShellProject[];
	teams: ShellTeam[];
	user: ShellUser;
}) {
	const slug = workspace.slug;
	const isActive = useIsActive(slug);
	const { isMobile } = useSidebar();
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const [expanded, setExpanded] = useState<Record<string, boolean>>({});

	return (
		<Sidebar collapsible="icon" aria-label="Main">
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<SidebarMenuButton
									className="font-medium"
									aria-label="Switch workspace"
								>
									<WorkspaceLogo workspace={workspace} className="-ml-1" />
									<span className="truncate">{workspace.name}</span>
									<span
										className="ml-auto icon-[solar--sort-vertical-linear] size-3.5 text-muted-foreground"
										aria-hidden="true"
									/>
								</SidebarMenuButton>
							</DropdownMenuTrigger>
							<DropdownMenuContent
								align="start"
								side={isMobile ? "bottom" : "right"}
								className="w-60"
							>
								<DropdownMenuLabel className="text-xs text-muted-foreground">
									Workspaces
								</DropdownMenuLabel>
								{workspaces.map((w) => (
									<DropdownMenuItem key={w.id} asChild>
										<Link to="/w/$slug" params={{ slug: w.slug }}>
											<WorkspaceLogo workspace={w} className="size-5" />
											<span className="truncate">{w.name}</span>
											{w.id === workspace.id && (
												<>
													<span
														className="ml-auto icon-[hugeicons--tick-02] size-4"
														aria-hidden="true"
													/>
													<span className="sr-only">(current)</span>
												</>
											)}
										</Link>
									</DropdownMenuItem>
								))}
								<DropdownMenuSeparator />
								<DropdownMenuItem asChild>
									<Link to="/onboarding">
										<span
											className="icon-[solar--add-square-linear] size-4"
											aria-hidden="true"
										/>
										Create workspace
									</Link>
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>

			<SidebarContent>
				<SidebarGroup>
					<SidebarMenu>
						{MAIN_NAV.map((item) => (
							<NavLink
								key={item.path}
								slug={slug}
								item={item}
								active={isActive(item.path)}
							/>
						))}
					</SidebarMenu>
				</SidebarGroup>

				<SidebarGroup>
					<SidebarGroupLabel>Workspace</SidebarGroupLabel>
					<SidebarMenu>
						{WORKSPACE_NAV.map((item) => (
							<NavLink
								key={item.path}
								slug={slug}
								item={item}
								active={isActive(item.path)}
							/>
						))}
					</SidebarMenu>
				</SidebarGroup>

				<SidebarGroup>
					<SidebarGroupLabel>Projects</SidebarGroupLabel>
					<SidebarGroupAction asChild title="New project">
						<Link
							to="/w/$slug/$"
							params={{ slug, _splat: "projects" }}
							aria-label="New project"
						>
							<span
								className="icon-[hugeicons--plus-sign] size-4"
								aria-hidden="true"
							/>
						</Link>
					</SidebarGroupAction>
					<SidebarGroupContent>
						<SidebarMenu>
							{projects.map((project) => {
								const base = `/w/${slug}/p/${project.id}`;
								const inProject =
									pathname === base || pathname.startsWith(`${base}/`);
								const open = expanded[project.id] ?? inProject;
								return (
									<Collapsible
										key={project.id}
										asChild
										open={open}
										onOpenChange={(value) =>
											setExpanded((x) => ({ ...x, [project.id]: value }))
										}
									>
										<SidebarMenuItem>
											<SidebarMenuButton
												asChild
												isActive={inProject}
												tooltip={project.title}
											>
												<Link
													to="/w/$slug/p/$projectId"
													params={{ slug, projectId: project.id }}
												>
													<span
														className={cn(
															project.icon ?? "icon-[solar--folder-linear]",
															"size-4 text-brand",
														)}
														aria-hidden="true"
													/>
													<span className="truncate">{project.title}</span>
												</Link>
											</SidebarMenuButton>
											<CollapsibleTrigger asChild>
												<SidebarMenuAction
													className="transition-transform duration-150 data-[state=open]:rotate-90"
													aria-label={`${open ? "Collapse" : "Expand"} ${project.title}`}
												>
													<span
														className="icon-[solar--alt-arrow-right-linear] size-3.5"
														aria-hidden="true"
													/>
												</SidebarMenuAction>
											</CollapsibleTrigger>
											<CollapsibleContent>
												<SidebarMenuSub>
													{PROJECT_TABS.map(({ tab, label, icon }) => (
														<SidebarMenuSubItem key={tab}>
															<SidebarMenuSubButton asChild>
																<Link
																	to="/w/$slug/p/$projectId"
																	params={{ slug, projectId: project.id }}
																	search={{ tab }}
																	activeOptions={{ includeSearch: true }}
																	activeProps={{ "data-active": true }}
																>
																	<span
																		className={cn(icon, "size-3.5")}
																		aria-hidden="true"
																	/>
																	<span>{label}</span>
																</Link>
															</SidebarMenuSubButton>
														</SidebarMenuSubItem>
													))}
												</SidebarMenuSub>
											</CollapsibleContent>
										</SidebarMenuItem>
									</Collapsible>
								);
							})}
							<NavLink
								slug={slug}
								item={ARCHIVE_NAV}
								active={isActive(ARCHIVE_NAV.path)}
							/>
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>

				<SidebarGroup>
					<SidebarGroupLabel>Teams</SidebarGroupLabel>
					<SidebarGroupAction asChild title="New team">
						<Link
							to="/w/$slug/$"
							params={{ slug, _splat: "teams" }}
							aria-label="New team"
						>
							<span
								className="icon-[hugeicons--plus-sign] size-4"
								aria-hidden="true"
							/>
						</Link>
					</SidebarGroupAction>
					<SidebarGroupContent>
						<SidebarMenu>
							{teams.length === 0 && (
								<p className="px-2 py-1 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
									No teams yet
								</p>
							)}
							{teams.map((team) => (
								<SidebarMenuItem key={team.id}>
									<SidebarMenuButton
										asChild
										isActive={isActive(`teams/${team.id}`)}
										tooltip={team.name}
									>
										<Link
											to="/w/$slug/$"
											params={{ slug, _splat: `teams/${team.id}` }}
										>
											<span
												className="size-2.5 rounded-full bg-muted-foreground"
												style={
													team.color
														? { backgroundColor: team.color }
														: undefined
												}
												aria-hidden="true"
											/>
											<span className="truncate">{team.name}</span>
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>
							))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>

			<SidebarFooter>
				<SidebarMenu>
					<HelpMenu />
					<NavLink
						slug={slug}
						item={SETTINGS_NAV}
						active={isActive(SETTINGS_NAV.path)}
					/>
					<SidebarMenuItem>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<SidebarMenuButton size="lg" aria-label="Account menu">
									<UserAvatar user={user} className="size-7" />
									<span className="flex min-w-0 flex-col text-left leading-tight">
										<span className="truncate font-medium">{user.name}</span>
										<span className="truncate text-xs text-muted-foreground">
											{user.email}
										</span>
									</span>
									<span
										className="ml-auto icon-[solar--sort-vertical-linear] size-3.5 text-muted-foreground"
										aria-hidden="true"
									/>
								</SidebarMenuButton>
							</DropdownMenuTrigger>
							<DropdownMenuContent
								align="end"
								side={isMobile ? "top" : "right"}
								className="w-60"
							>
								<UserMenuItems user={user} />
							</DropdownMenuContent>
						</DropdownMenu>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}

function HelpMenu() {
	const { openPalette, openShortcuts } = useCommandMenu();
	const { isMobile } = useSidebar();
	const mod = useModKey();
	return (
		<SidebarMenuItem>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<SidebarMenuButton tooltip="Help & resources">
						<span
							className="icon-[solar--question-circle-linear] size-4"
							aria-hidden="true"
						/>
						<span>Help & resources</span>
					</SidebarMenuButton>
				</DropdownMenuTrigger>
				<DropdownMenuContent
					align="end"
					side={isMobile ? "top" : "right"}
					className="w-60"
				>
					<DropdownMenuLabel className="text-xs text-muted-foreground">
						Help & resources
					</DropdownMenuLabel>
					<DropdownMenuItem onSelect={openShortcuts}>
						<span
							className="icon-[solar--keyboard-linear] size-4"
							aria-hidden="true"
						/>
						Keyboard shortcuts
						<DropdownMenuShortcut>?</DropdownMenuShortcut>
					</DropdownMenuItem>
					<DropdownMenuItem onSelect={openPalette}>
						<span
							className="icon-[solar--command-linear] size-4"
							aria-hidden="true"
						/>
						Command menu
						<DropdownMenuShortcut>{mod} K</DropdownMenuShortcut>
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</SidebarMenuItem>
	);
}
