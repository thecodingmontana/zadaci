import { useNavigate } from "@tanstack/react-router";
import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useState,
} from "react";
import {
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
	CommandShortcut,
} from "#/components/ui/command";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import { Kbd, KbdGroup } from "#/components/ui/kbd";
import { useSidebar } from "#/components/ui/sidebar";
import type { ShellProject, WorkspaceSummary } from "#/graphql/operations";
import { authClient } from "#/lib/auth-client";
import { toast } from "#/lib/toast";
import { cn } from "#/lib/utils";
import { WorkspaceLogo } from "./app-sidebar";
import { ARCHIVE_NAV, MAIN_NAV, SETTINGS_NAV, WORKSPACE_NAV } from "./nav";

type CommandMenu = { openPalette: () => void; openShortcuts: () => void };
const CommandMenuContext = createContext<CommandMenu | null>(null);

export function useCommandMenu() {
	const ctx = useContext(CommandMenuContext);
	if (!ctx)
		throw new Error("useCommandMenu must be used inside CommandMenuProvider");
	return ctx;
}

const isMac = () =>
	typeof navigator !== "undefined" &&
	/Mac|iPhone|iPad/.test(navigator.platform);
const modKey = () => (isMac() ? "⌘" : "Ctrl");

/** "Ctrl" during SSR and hydration, the real key after mount, so markup never mismatches. */
export function useModKey() {
	const [key, setKey] = useState("Ctrl");
	useEffect(() => setKey(modKey()), []);
	return key;
}

function isTyping(target: EventTarget | null) {
	return (
		target instanceof HTMLElement &&
		(target.isContentEditable ||
			["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
	);
}

const SHORTCUTS = [
	{ keys: ["mod", "K"], label: "Open the command menu" },
	{ keys: ["mod", "B"], label: "Toggle the sidebar" },
	{ keys: ["?"], label: "Show keyboard shortcuts" },
];

export function CommandMenuProvider({
	slug,
	workspaces,
	projects,
	children,
}: {
	slug: string;
	workspaces: WorkspaceSummary[];
	projects: ShellProject[];
	children: ReactNode;
}) {
	const navigate = useNavigate();
	const mod = useModKey();
	const { toggleSidebar } = useSidebar();
	const [palette, setPalette] = useState(false);
	const [shortcuts, setShortcuts] = useState(false);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				setPalette((open) => !open);
			} else if (e.key === "?" && !isTyping(e.target)) {
				e.preventDefault();
				setShortcuts(true);
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);

	const run = (fn: () => unknown) => () => {
		setPalette(false);
		fn();
	};
	const go = (path: string) =>
		run(() =>
			path
				? navigate({ to: "/w/$slug/$", params: { slug, _splat: path } })
				: navigate({ to: "/w/$slug", params: { slug } }),
		);

	return (
		<CommandMenuContext.Provider
			value={{
				openPalette: () => setPalette(true),
				openShortcuts: () => setShortcuts(true),
			}}
		>
			{children}

			<CommandDialog
				open={palette}
				onOpenChange={setPalette}
				title="Search or jump to"
				description="Search pages, projects and actions"
				showCloseButton={false}
			>
				<CommandInput placeholder="Search or jump to…" />
				<CommandList>
					<CommandEmpty>No results found.</CommandEmpty>
					<CommandGroup heading="Go to">
						{[...MAIN_NAV, ...WORKSPACE_NAV, ARCHIVE_NAV, SETTINGS_NAV].map(
							(item) => (
								<CommandItem
									key={item.path}
									value={`go ${item.label}`}
									onSelect={go(item.path)}
								>
									<span
										className={cn(item.icon, "size-4")}
										aria-hidden="true"
									/>
									{item.label}
								</CommandItem>
							),
						)}
					</CommandGroup>
					{projects.length > 0 && (
						<CommandGroup heading="Projects">
							{projects.map((project) => (
								<CommandItem
									key={project.id}
									value={`project ${project.title} ${project.id}`}
									onSelect={run(() =>
										navigate({
											to: "/w/$slug/p/$projectId",
											params: { slug, projectId: project.id },
										}),
									)}
								>
									<span
										className={cn(
											project.icon ?? "icon-[solar--folder-linear]",
											"size-4 text-brand",
										)}
										aria-hidden="true"
									/>
									{project.title}
								</CommandItem>
							))}
						</CommandGroup>
					)}
					<CommandGroup heading="Workspaces">
						{workspaces.map((w) => (
							<CommandItem
								key={w.id}
								value={`workspace ${w.name} ${w.slug}`}
								onSelect={run(() =>
									navigate({ to: "/w/$slug", params: { slug: w.slug } }),
								)}
							>
								<WorkspaceLogo workspace={w} className="size-5" />
								{w.name}
								{w.slug === slug && <CommandShortcut>Current</CommandShortcut>}
							</CommandItem>
						))}
						<CommandItem
							value="create workspace new"
							onSelect={run(() => navigate({ to: "/onboarding" }))}
						>
							<span
								className="icon-[solar--add-square-linear] size-4"
								aria-hidden="true"
							/>
							Create workspace
						</CommandItem>
					</CommandGroup>
					<CommandSeparator />
					<CommandGroup heading="Actions">
						<CommandItem value="toggle sidebar" onSelect={run(toggleSidebar)}>
							<span
								className="icon-[solar--sidebar-minimalistic-linear] size-4"
								aria-hidden="true"
							/>
							Toggle sidebar
							<CommandShortcut>{mod} B</CommandShortcut>
						</CommandItem>
						<CommandItem
							value="keyboard shortcuts help"
							onSelect={run(() => setShortcuts(true))}
						>
							<span
								className="icon-[solar--keyboard-linear] size-4"
								aria-hidden="true"
							/>
							Keyboard shortcuts
							<CommandShortcut>?</CommandShortcut>
						</CommandItem>
						<CommandItem
							value="add passkey security"
							onSelect={run(async () => {
								const { error } = await authClient.passkey.addPasskey();
								if (!error) toast.success("Passkey added");
								else if (
									!(
										"code" in error &&
										["AUTH_CANCELLED", "ERROR_CEREMONY_ABORTED"].includes(
											error.code,
										)
									)
								)
									toast.error("Couldn't add a passkey", {
										desc: error.message,
									});
							})}
						>
							<span
								className="icon-[solar--key-minimalistic-linear] size-4"
								aria-hidden="true"
							/>
							Add a passkey
						</CommandItem>
						<CommandItem
							value="sign out log out"
							onSelect={run(async () => {
								await authClient.signOut();
								navigate({ to: "/auth/signin" });
							})}
						>
							<span
								className="icon-[solar--logout-2-linear] size-4"
								aria-hidden="true"
							/>
							Sign out
						</CommandItem>
					</CommandGroup>
				</CommandList>
			</CommandDialog>

			<Dialog open={shortcuts} onOpenChange={setShortcuts}>
				<DialogContent className="sm:max-w-sm">
					<DialogHeader>
						<DialogTitle>Keyboard shortcuts</DialogTitle>
						<DialogDescription>
							Move around Zadaci without the mouse.
						</DialogDescription>
					</DialogHeader>
					<ul className="flex flex-col gap-2.5">
						{SHORTCUTS.map((s) => (
							<li
								key={s.label}
								className="flex items-center justify-between gap-4 text-sm"
							>
								{s.label}
								<KbdGroup>
									{s.keys.map((k) => (
										<Kbd key={k}>{k === "mod" ? mod : k}</Kbd>
									))}
								</KbdGroup>
							</li>
						))}
					</ul>
				</DialogContent>
			</Dialog>
		</CommandMenuContext.Provider>
	);
}
