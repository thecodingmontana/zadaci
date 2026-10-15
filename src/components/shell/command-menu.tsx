import { useQuery } from "@apollo/client/react";
import { useNavigate } from "@tanstack/react-router";
import { Dialog, VisuallyHidden } from "radix-ui";
import {
	createContext,
	type KeyboardEvent,
	type ReactNode,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { Av } from "#/components/q/av";
import { Modal } from "#/components/q/modal";
import { StatusIcon } from "#/components/q/status-icon";
import { WsLogo } from "#/components/q/ws-logo";
import { ZadaciLogo } from "#/components/zadaci-logo";
import {
	SEARCH,
	type ShellProject,
	type WorkspaceSummary,
} from "#/graphql/operations";
import { isDark, setAppearance } from "#/lib/appearance";
import { authClient } from "#/lib/auth-client";
import { PCOLORS } from "#/lib/onboarding";
import { cn } from "#/lib/utils";
import { useShell } from "./shell-state";

// Command palette ported from the reference app: three modes (commands, search, workspace switch),
// Tab toggles search mode, Backspace on an empty query returns to commands.

type Mode = "cmd" | "search" | "ws";
type Scope = "all" | "tasks" | "projects" | "people";
type Item = {
	id: string;
	icon?: string;
	node?: ReactNode;
	name: string;
	sub?: string;
	r?: string;
	kbd?: string[];
	run: () => void;
};
type Group = { name: string; items: Item[] };
type Palette = { mode: Mode; q: string; scope: Scope; hl: number };

type CommandMenu = {
	openPalette: () => void;
	openSearch: () => void;
	openShortcuts: () => void;
};
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

/** "Ctrl" during SSR and hydration, the real key after mount, so markup never mismatches. */
export function useModKey() {
	const [key, setKey] = useState("Ctrl");
	useEffect(() => setKey(isMac() ? "⌘" : "Ctrl"), []);
	return key;
}

const SCOPES: [Scope, string, string][] = [
	["all", "All", "icon-[solar--layers-linear]"],
	["tasks", "Tasks", "icon-[solar--check-circle-linear]"],
	["projects", "Projects", "icon-[solar--folder-linear]"],
	["people", "People", "icon-[solar--users-group-rounded-linear]"],
];

const RECENT_KEY = "zadaci.recentSearches";
function readRecent(): string[] {
	try {
		return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
	} catch {
		return [];
	}
}
function pushRecent(q: string) {
	try {
		localStorage.setItem(
			RECENT_KEY,
			JSON.stringify([q, ...readRecent().filter((x) => x !== q)].slice(0, 5)),
		);
	} catch {}
}

function highlight(text: string, q: string): ReactNode {
	const i = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
	if (i < 0) return text;
	return (
		<>
			{text.slice(0, i)}
			<mark>{text.slice(i, i + q.length)}</mark>
			{text.slice(i + q.length)}
		</>
	);
}

function isTyping(target: EventTarget | null) {
	return (
		target instanceof HTMLElement &&
		(target.isContentEditable ||
			["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
	);
}

export const SHORTCUTS: [string, [string, string[]][]][] = [
	[
		"General",
		[
			["Command menu", ["mod", "K"]],
			["Search", ["/"]],
			["Keyboard shortcuts", ["?"]],
			["Toggle sidebar", ["["]],
			["Toggle dark mode", ["mod", "Shift", "L"]],
			["Close panel or dialog", ["Esc"]],
		],
	],
	[
		"Navigate",
		[
			["Go to Home", ["G", "H"]],
			["Go to My Tasks", ["G", "T"]],
			["Go to Projects", ["G", "P"]],
			["Go to Inbox", ["G", "I"]],
			["Go to Calendar", ["G", "C"]],
			["Go to Settings", ["G", "S"]],
		],
	],
	[
		"Command menu",
		[
			["Move selection", ["↑", "↓"]],
			["Run command", ["↵"]],
			["Search mode", ["Tab"]],
		],
	],
];

const G_ROUTES: Record<string, string> = {
	h: "",
	t: "my-tasks",
	p: "projects",
	i: "inbox",
	c: "calendar",
	s: "settings",
	n: "notifications",
	a: "activity",
	m: "members",
};

export function CommandMenuProvider({
	slug,
	workspaces,
	children,
}: {
	slug: string;
	workspaces: WorkspaceSummary[];
	projects: ShellProject[];
	children: ReactNode;
}) {
	const navigate = useNavigate();
	const mod = useModKey();
	const { toggleSide: toggleSidebar, setMnav } = useShell();
	const [pal, setPal] = useState<Palette | null>(null);
	const [shortcuts, setShortcuts] = useState(false);
	const gPending = useRef(0);

	const go = (path: string, search?: string) =>
		navigate({
			href: `/w/${slug}${path ? `/${path}` : ""}${search ? `?${search}` : ""}`,
		});
	// Overlays close the phone drawer first so they never open underneath it.
	const open = (mode: Mode) => {
		setMnav(false);
		setPal({ mode, q: "", scope: "all", hl: 0 });
	};
	const showShortcuts = () => {
		setMnav(false);
		setShortcuts(true);
	};
	const toggleDark = () =>
		setAppearance({ theme: isDark() ? "light" : "dark" });

	useEffect(() => {
		const onKey = (e: globalThis.KeyboardEvent) => {
			const modKey = e.metaKey || e.ctrlKey;
			if (modKey && e.key.toLowerCase() === "k") {
				e.preventDefault();
				setPal((p) => (p ? null : { mode: "cmd", q: "", scope: "all", hl: 0 }));
				return;
			}
			if (modKey && e.shiftKey && e.key.toLowerCase() === "l") {
				e.preventDefault();
				toggleDark();
				return;
			}
			if (
				isTyping(e.target) ||
				modKey ||
				e.altKey ||
				document.querySelector('[role="dialog"]')
			)
				return;
			const k = e.key.toLowerCase();
			if (gPending.current && Date.now() - gPending.current < 1200) {
				gPending.current = 0;
				if (k in G_ROUTES) {
					e.preventDefault();
					go(G_ROUTES[k] ?? "");
				}
				return;
			}
			if (k === "g") gPending.current = Date.now();
			else if (e.key === "/") {
				e.preventDefault();
				open("search");
			} else if (e.key === "?") {
				e.preventDefault();
				showShortcuts();
			} else if (e.key === "[") {
				e.preventDefault();
				toggleSidebar();
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	});

	const commands: Item[] = [
		{
			id: "c-search",
			name: "Search workspace",
			icon: "icon-[solar--magnifer-linear]",
			kbd: ["/"],
			run: () => open("search"),
		},
		{
			id: "c-home",
			name: "Go to Home",
			icon: "icon-[solar--home-2-linear]",
			kbd: ["G", "H"],
			run: () => go(""),
		},
		{
			id: "c-inbox",
			name: "Go to Inbox",
			icon: "icon-[solar--inbox-linear]",
			kbd: ["G", "I"],
			run: () => go("inbox"),
		},
		{
			id: "c-my",
			name: "Go to My Tasks",
			icon: "icon-[solar--check-circle-linear]",
			kbd: ["G", "T"],
			run: () => go("my-tasks"),
		},
		{
			id: "c-projs",
			name: "Go to Projects",
			icon: "icon-[solar--folder-with-files-linear]",
			kbd: ["G", "P"],
			run: () => go("projects"),
		},
		{
			id: "c-cal",
			name: "Go to Calendar",
			icon: "icon-[solar--calendar-linear]",
			kbd: ["G", "C"],
			run: () => go("calendar"),
		},
		{
			id: "c-tl",
			name: "Go to Timeline",
			icon: "icon-[hugeicons--chart-gantt]",
			run: () => go("timeline"),
		},
		{
			id: "c-mem",
			name: "Go to Members",
			icon: "icon-[solar--users-group-rounded-linear]",
			run: () => go("members"),
		},
		{
			id: "c-set",
			name: "Open settings",
			icon: "icon-[solar--settings-linear]",
			kbd: ["G", "S"],
			run: () => go("settings"),
		},
		{
			id: "c-app",
			name: "Appearance settings",
			icon: "icon-[solar--pallete-2-linear]",
			run: () => go("settings", "sec=appearance"),
		},
		{
			id: "c-ws",
			name: "Switch workspace…",
			icon: "icon-[solar--transfer-horizontal-linear]",
			run: () => open("ws"),
		},
		isDark()
			? {
					id: "c-dark",
					name: "Switch to light mode",
					icon: "icon-[solar--sun-2-linear]",
					kbd: ["mod", "⇧", "L"],
					run: toggleDark,
				}
			: {
					id: "c-dark",
					name: "Switch to dark mode",
					icon: "icon-[solar--moon-linear]",
					kbd: ["mod", "⇧", "L"],
					run: toggleDark,
				},
		{
			id: "c-inv",
			name: "Invite member",
			icon: "icon-[solar--user-plus-linear]",
			run: () => go("settings", "sec=members"),
		},
		{
			id: "c-side",
			name: "Toggle sidebar",
			icon: "icon-[solar--sidebar-minimalistic-linear]",
			kbd: ["["],
			run: toggleSidebar,
		},
		{
			id: "c-keys",
			name: "Keyboard shortcuts",
			icon: "icon-[solar--keyboard-linear]",
			kbd: ["?"],
			run: showShortcuts,
		},
		{
			id: "c-out",
			name: "Sign out",
			icon: "icon-[solar--logout-2-linear]",
			run: async () => {
				await authClient.signOut();
				navigate({ to: "/auth/signin" });
			},
		},
	];

	return (
		<CommandMenuContext.Provider
			value={{
				openPalette: () => open("cmd"),
				openSearch: () => open("search"),
				openShortcuts: showShortcuts,
			}}
		>
			{children}
			{pal && (
				<PaletteDialog
					pal={pal}
					setPal={setPal}
					slug={slug}
					workspaces={workspaces}
					mod={mod}
					commands={commands}
					goTo={go}
					onProject={(id) =>
						navigate({
							to: "/w/$slug/p/$projectId",
							params: { slug, projectId: id },
						})
					}
					onWorkspace={(s) => navigate({ to: "/w/$slug", params: { slug: s } })}
				/>
			)}
			<Modal
				open={shortcuts}
				onOpenChange={setShortcuts}
				title="Keyboard shortcuts"
				size="lg"
			>
				<div
					className="modal-b"
					style={{
						display: "grid",
						gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))",
						gap: 22,
					}}
				>
					{SHORTCUTS.map(([group, list]) => (
						<div key={group}>
							<div className="eyebrow" style={{ marginBottom: 6 }}>
								{group}
							</div>
							{list.map(([name, keys]) => (
								<div
									key={name}
									className="row"
									style={{
										height: 30,
										fontSize: 13,
										borderBottom: "1px solid var(--q-divider)",
									}}
								>
									<span className="grow">{name}</span>
									{keys.map((k, i) => (
										<span key={k} className="row" style={{ gap: 4 }}>
											{i > 0 && keys[0] === "G" && (
												<span className="faint" style={{ fontSize: 11 }}>
													then
												</span>
											)}
											<kbd>{k === "mod" ? mod : k}</kbd>
										</span>
									))}
								</div>
							))}
						</div>
					))}
				</div>
			</Modal>
		</CommandMenuContext.Provider>
	);
}

function PaletteDialog({
	pal,
	setPal,
	slug,
	workspaces,
	mod,
	commands,
	goTo,
	onProject,
	onWorkspace,
}: {
	pal: Palette;
	setPal: (p: Palette | null | ((p: Palette | null) => Palette | null)) => void;
	slug: string;
	workspaces: WorkspaceSummary[];
	mod: string;
	commands: Item[];
	goTo: (path: string) => void;
	onProject: (id: string) => void;
	onWorkspace: (slug: string) => void;
}) {
	const q = pal.q.trim();
	const ql = q.toLowerCase();
	const [debounced, setDebounced] = useState(q);
	useEffect(() => {
		const id = setTimeout(() => setDebounced(q), 150);
		return () => clearTimeout(id);
	}, [q]);
	const { data, previousData } = useQuery(SEARCH, {
		variables: { slug, q: debounced },
		skip: !debounced || pal.mode === "ws",
	});
	const results = (data ?? previousData)?.search;
	const listRef = useRef<HTMLDivElement>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: callbacks are recreated each render; groups only depend on query state and results
	const groups = useMemo<Group[]>(() => {
		const out: Group[] = [];
		if (pal.mode === "ws") {
			out.push({
				name: "Switch workspace",
				items: workspaces
					.filter((w) => !ql || w.name.toLowerCase().includes(ql))
					.map((w) => ({
						id: `ws-${w.id}`,
						node: <WsLogo workspace={w} px={20} />,
						name: w.name,
						sub: `${w.role[0]?.toUpperCase()}${w.role.slice(1)}${w.slug === slug ? " · Current" : ""}`,
						run: () => onWorkspace(w.slug),
					})),
			});
			return out;
		}
		if (pal.mode === "cmd") {
			const cmds = commands.filter(
				(c) => !ql || c.name.toLowerCase().includes(ql),
			);
			if (!q) {
				out.push({
					name: "Suggestions",
					items: [
						...cmds.slice(0, 3),
						...cmds.filter((c) => c.id === "c-dark" || c.id === "c-ws"),
					],
				});
				out.push({
					name: "Navigation",
					items: cmds.filter((c) => c.name.startsWith("Go to")),
				});
				return out;
			}
			if (cmds.length) out.push({ name: "Commands", items: cmds.slice(0, 5) });
		}
		const scope = pal.mode === "search" ? pal.scope : "all";
		const lim = scope === "all" ? 4 : 12;
		if (pal.mode === "search" && !q) {
			const recent = readRecent();
			if (recent.length) {
				out.push({
					name: "Recent searches",
					items: recent.map((s) => ({
						id: `r-${s}`,
						icon: "icon-[solar--history-linear]",
						name: s,
						run: () => setPal((p) => (p ? { ...p, q: s, hl: 0 } : p)),
					})),
				});
			}
			out.push({
				name: "Suggested",
				items: [
					{
						id: "s-over",
						icon: "icon-[solar--alarm-linear]",
						name: "Overdue tasks",
						run: () => goTo("tasks"),
					},
					{
						id: "s-me",
						icon: "icon-[solar--user-linear]",
						name: "Tasks assigned to me",
						run: () => goTo("my-tasks"),
					},
				],
			});
			return out;
		}
		if (!q || !results) return out;
		const remember = (fn: () => void) => () => {
			pushRecent(q);
			fn();
		};
		if (scope === "all" || scope === "tasks") {
			out.push({
				name: "Tasks",
				items: results.tasks.slice(0, lim).map((t) => ({
					id: `t-${t.id}`,
					node: <StatusIcon status={t.status} size={15} />,
					name: t.name,
					sub: t.projectTitle,
					run: remember(() => onProject(t.projectId)),
				})),
			});
		}
		if (scope === "all" || scope === "projects") {
			out.push({
				name: "Projects",
				items: results.projects.slice(0, lim).map((p) => ({
					id: `p-${p.id}`,
					node: (
						<span
							className="pdot"
							style={
								{
									"--c": PCOLORS[p.color ?? ""] ?? PCOLORS.indigo,
								} as React.CSSProperties
							}
						/>
					),
					name: p.title,
					run: remember(() => onProject(p.id)),
				})),
			});
		}
		if (scope === "all" || scope === "people") {
			out.push({
				name: "People",
				items: results.people.slice(0, lim).map((m) => ({
					id: `m-${m.id}`,
					node: <Av name={m.name} image={m.image} className="sm" />,
					name: m.name,
					sub: m.email,
					run: remember(() => goTo("members")),
				})),
			});
		}
		return out.filter((g) => g.items.length);
	}, [pal.mode, pal.scope, q, ql, results, workspaces, slug]);

	const flat = groups.flatMap((g) => g.items);
	const hl = Math.min(pal.hl, Math.max(flat.length - 1, 0));
	const run = (item: Item | undefined) => {
		if (!item) return;
		setPal(null);
		item.run();
	};

	useEffect(() => {
		listRef.current
			?.querySelector(".pi.hl")
			?.scrollIntoView({ block: "nearest" });
	});

	const onKeyDown = (e: KeyboardEvent) => {
		const n = Math.max(flat.length, 1);
		if (e.key === "ArrowDown") {
			e.preventDefault();
			setPal({ ...pal, hl: (hl + 1) % n });
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			setPal({ ...pal, hl: (hl - 1 + n) % n });
		} else if (e.key === "Enter") {
			e.preventDefault();
			run(flat[hl]);
		} else if (e.key === "Tab") {
			e.preventDefault();
			setPal({ ...pal, mode: pal.mode === "cmd" ? "search" : "cmd", hl: 0 });
		} else if (e.key === "Backspace" && !pal.q && pal.mode !== "cmd") {
			e.preventDefault();
			setPal({ ...pal, mode: "cmd", hl: 0 });
		}
	};

	const placeholder =
		pal.mode === "search"
			? "Search tasks, projects, people…"
			: pal.mode === "ws"
				? "Find a workspace…"
				: "Type a command or search…";
	let idx = 0;

	return (
		<Dialog.Root open onOpenChange={(o) => !o && setPal(null)}>
			<Dialog.Portal>
				<Dialog.Overlay className="scrim" style={{ zIndex: 89 }} />
				<Dialog.Content
					className="palette"
					aria-describedby={undefined}
					onKeyDown={onKeyDown}
				>
					<VisuallyHidden.Root asChild>
						<Dialog.Title>Command menu</Dialog.Title>
					</VisuallyHidden.Root>
					<div className="pal-in">
						<span
							className={cn(
								pal.mode === "search"
									? "icon-[solar--magnifer-linear]"
									: "icon-[solar--command-linear]",
								"size-[17px] shrink-0 text-(--q-text-3)",
							)}
							aria-hidden="true"
						/>
						{pal.mode !== "cmd" && (
							<span className="badge" style={{ flexShrink: 0 }}>
								{pal.mode === "search" ? "Search" : "Workspace"}
							</span>
						)}
						<input
							id="pal-in"
							value={pal.q}
							onChange={(e) => setPal({ ...pal, q: e.target.value, hl: 0 })}
							placeholder={placeholder}
							autoComplete="off"
							role="combobox"
							aria-expanded="true"
							aria-controls="pal-list"
							aria-activedescendant={flat.length ? `pi-${hl}` : undefined}
						/>
						<kbd>Esc</kbd>
					</div>
					{pal.mode === "search" && (
						<div className="pal-scope" role="tablist">
							{SCOPES.map(([k, name, icon]) => (
								<button
									key={k}
									type="button"
									role="tab"
									aria-selected={pal.scope === k}
									className={pal.scope === k ? "on" : ""}
									onClick={() => {
										setPal({ ...pal, scope: k, hl: 0 });
										document.getElementById("pal-in")?.focus();
									}}
								>
									<span className={cn(icon, "size-3")} aria-hidden="true" />
									{name}
								</button>
							))}
						</div>
					)}
					<div className="pal-list" id="pal-list" role="listbox" ref={listRef}>
						{flat.length ? (
							groups.map((g) => (
								<div key={g.name} className="pal-group">
									{g.name && <div className="pal-sec">{g.name}</div>}
									{g.items.map((it) => {
										const i = idx++;
										return (
											// biome-ignore lint/a11y/useKeyWithClickEvents: keyboard selection is handled on the combobox input (arrows + Enter)
											<div
												key={it.id}
												id={`pi-${i}`}
												role="option"
												tabIndex={-1}
												aria-selected={i === hl}
												className={cn("pi", i === hl && "hl")}
												onMouseMove={() =>
													i !== hl && setPal({ ...pal, hl: i })
												}
												onClick={() => run(it)}
											>
												{it.node ?? (
													<span
														className={cn(it.icon, "i size-[15px] shrink-0")}
														aria-hidden="true"
													/>
												)}
												<span className="trunc">{highlight(it.name, q)}</span>
												{it.sub && <span className="sub">{it.sub}</span>}
												<span className="r">
													{it.r && <span className="mono">{it.r}</span>}
													{it.kbd?.map((k) => (
														<kbd key={k}>{k === "mod" ? mod : k}</kbd>
													))}
												</span>
											</div>
										);
									})}
								</div>
							))
						) : (
							<div className="empty-state sm">
								<div className="glyph">
									<span
										className="icon-[hugeicons--search-remove] size-[18px]"
										aria-hidden="true"
									/>
								</div>
								<h2 className="es-h">No results found</h2>
								<p>
									Try a different keyword, or press Tab to search everything.
								</p>
							</div>
						)}
					</div>
					<div className="pal-f">
						<span>
							<kbd>↑</kbd>
							<kbd>↓</kbd>navigate
						</span>
						<span>
							<kbd>↵</kbd>select
						</span>
						{pal.mode === "cmd" ? (
							<span>
								<kbd>Tab</kbd>search mode
							</span>
						) : (
							<span>
								<kbd>⌫</kbd>back to commands
							</span>
						)}
						<span className="sp" style={{ flex: 1 }} />
						<span>
							<ZadaciLogo className="size-3" />
						</span>
					</div>
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
