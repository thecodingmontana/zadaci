import {
	createFileRoute,
	Link,
	notFound,
	Outlet,
	useRouterState,
} from "@tanstack/react-router";
import { PageNotFound } from "#/components/states";
import { ZadaciLogo } from "#/components/zadaci-logo";
import { cn } from "#/lib/utils";

// The admin area, for whoever ADMIN_EMAILS lists: Dashboard (how Zadaci is used), System (errors,
// the hourly job, GitHub links, the database) and Directory (people and workspaces). Same sidebar
// as the app. Every page's data is checked on the server too: this guard only hides the pages.

const NAV = [
	{ to: "/admin", label: "Dashboard", icon: "icon-[solar--home-2-linear]" },
	{
		to: "/admin/system",
		label: "System",
		icon: "icon-[solar--pulse-2-linear]",
	},
	{
		to: "/admin/directory",
		label: "Directory",
		icon: "icon-[solar--users-group-rounded-linear]",
	},
] as const;

export const Route = createFileRoute("/_authed/admin")({
	// drawn in the browser only: charts measure their box, and times read "3m ago" on your clock
	ssr: false,
	beforeLoad: ({ context }) => {
		if (!(context as { admin?: boolean }).admin) throw notFound();
	},
	head: () => ({ meta: [{ title: "Admin - Zadaci" }] }),
	notFoundComponent: PageNotFound,
	component: AdminLayout,
});

function AdminLayout() {
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	return (
		<div className="shell h-dvh">
			<nav className="side" aria-label="Admin">
				<div className="side-top">
					<div className="ws">
						<span className="ws-logo brand">
							<ZadaciLogo />
						</span>
						<span className="ws-name trunc">Zadaci admin</span>
					</div>
				</div>
				<div className="side-scroll">
					{NAV.map((item) => {
						const on =
							item.to === "/admin"
								? pathname === "/admin" || pathname === "/admin/"
								: pathname.startsWith(item.to);
						return (
							<Link
								key={item.to}
								to={item.to}
								className={cn("sitem", on && "on")}
								aria-current={on ? "page" : undefined}
							>
								<span
									className={cn(item.icon, "i size-4 shrink-0")}
									aria-hidden="true"
								/>
								<span className="trunc">{item.label}</span>
							</Link>
						);
					})}
				</div>
				<div className="side-bot">
					<Link to="/workspace" className="sitem">
						<span
							className="i icon-[solar--arrow-left-linear] size-4 shrink-0"
							aria-hidden="true"
						/>
						<span>Back to Zadaci</span>
					</Link>
				</div>
			</nav>
			<main className="main" id="main">
				<div className="min-h-0 flex-1 overflow-y-auto">
					<Outlet />
				</div>
			</main>
		</div>
	);
}
