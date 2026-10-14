import { Link, useRouterState } from "@tanstack/react-router";
import { Fragment } from "react";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "#/components/ui/breadcrumb";
import { Button } from "#/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { SidebarTrigger, useSidebar } from "#/components/ui/sidebar";
import type { ShellProject, ShellTeam } from "#/graphql/operations";
import { cn } from "#/lib/utils";
import { type ShellUser, UserAvatar, UserMenuItems } from "./app-sidebar";
import { useCommandMenu, useModKey } from "./command-menu";
import { BOTTOM_NAV, navItem } from "./nav";

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

	return (
		<header className="sticky top-0 z-10 flex h-[46px] shrink-0 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur supports-backdrop-filter:bg-background/80">
			<SidebarTrigger aria-label="Toggle sidebar" />
			<Breadcrumb className="min-w-0">
				<BreadcrumbList className="flex-nowrap">
					{crumbs.map((crumb, i) => (
						<Fragment key={crumb.label}>
							{i > 0 && <BreadcrumbSeparator />}
							<BreadcrumbItem className="min-w-0">
								{crumb.path ? (
									<BreadcrumbLink asChild>
										<Link to="/w/$slug/$" params={{ slug, _splat: crumb.path }}>
											{crumb.label}
										</Link>
									</BreadcrumbLink>
								) : (
									<BreadcrumbPage className="truncate">
										{crumb.label}
									</BreadcrumbPage>
								)}
							</BreadcrumbItem>
						</Fragment>
					))}
				</BreadcrumbList>
			</Breadcrumb>
			<span className="grow" />
			<SearchButton />
			<Button variant="ghost" size="icon-sm" asChild>
				<Link
					to="/w/$slug/$"
					params={{ slug, _splat: "notifications" }}
					aria-label="Notifications"
				>
					<span
						className="icon-[solar--bell-linear] size-4.5"
						aria-hidden="true"
					/>
				</Link>
			</Button>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="outline" size="sm" aria-label="Create new">
						<span
							className="icon-[hugeicons--plus-sign] size-3.5"
							aria-hidden="true"
						/>
						<span className="max-sm:hidden">New</span>
						<span
							className="icon-[solar--alt-arrow-down-linear] size-3 max-sm:hidden"
							aria-hidden="true"
						/>
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-48">
					<DropdownMenuItem asChild>
						<Link to="/w/$slug/$" params={{ slug, _splat: "projects" }}>
							<span
								className="icon-[solar--folder-with-files-linear] size-4"
								aria-hidden="true"
							/>
							New project
						</Link>
					</DropdownMenuItem>
					<DropdownMenuItem asChild>
						<Link to="/w/$slug/$" params={{ slug, _splat: "tasks" }}>
							<span
								className="icon-[solar--checklist-minimalistic-linear] size-4"
								aria-hidden="true"
							/>
							New task
						</Link>
					</DropdownMenuItem>
					<DropdownMenuItem asChild>
						<Link to="/onboarding">
							<span
								className="icon-[solar--buildings-2-linear] size-4"
								aria-hidden="true"
							/>
							New workspace
						</Link>
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						variant="ghost"
						size="icon-sm"
						className="rounded-full max-md:hidden"
						aria-label="Account menu"
					>
						<UserAvatar user={user} className="size-7" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-60">
					<UserMenuItems user={user} />
				</DropdownMenuContent>
			</DropdownMenu>
		</header>
	);
}

export function BottomNav({ slug }: { slug: string }) {
	const { setOpenMobile } = useSidebar();
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const item =
		"flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium";

	return (
		<nav
			aria-label="Primary"
			className="fixed inset-x-0 bottom-0 z-20 flex h-14 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
		>
			{BOTTOM_NAV.map((nav) => {
				const href = nav.path ? `/w/${slug}/${nav.path}` : `/w/${slug}`;
				const active = nav.path ? pathname.startsWith(href) : pathname === href;
				const content = (
					<>
						<span className={cn(nav.icon, "size-5")} aria-hidden="true" />
						{nav.label}
					</>
				);
				const className = cn(
					item,
					active ? "text-brand" : "text-muted-foreground",
				);
				return nav.path ? (
					<Link
						key={nav.path}
						to="/w/$slug/$"
						params={{ slug, _splat: nav.path }}
						className={className}
						aria-current={active ? "page" : undefined}
					>
						{content}
					</Link>
				) : (
					<Link
						key="home"
						to="/w/$slug"
						params={{ slug }}
						className={className}
						aria-current={active ? "page" : undefined}
					>
						{content}
					</Link>
				);
			})}
			<button
				type="button"
				className={cn(item, "text-muted-foreground")}
				onClick={() => setOpenMobile(true)}
			>
				<span
					className="icon-[solar--menu-dots-bold] size-5"
					aria-hidden="true"
				/>
				More
			</button>
		</nav>
	);
}

function SearchButton() {
	const { openPalette } = useCommandMenu();
	const mod = useModKey();
	return (
		<button
			type="button"
			className="topsearch max-sm:w-auto!"
			onClick={openPalette}
			aria-label="Search and commands"
		>
			<span
				className="icon-[solar--magnifer-linear] size-3.5 shrink-0"
				aria-hidden="true"
			/>
			<span className="lbltxt max-sm:hidden">Search or jump to…</span>
			<span className="kbd max-sm:hidden">{mod}K</span>
		</button>
	);
}
