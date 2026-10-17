import { useMutation, useQuery } from "@apollo/client/react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
	type DragEvent,
	type ReactNode,
	useEffect,
	useMemo,
	useState,
} from "react";
import { ConfirmModal } from "#/components/q/confirm";
import {
	Menu,
	MenuContent,
	MenuItem,
	MenuSeparator,
	MenuTrigger,
} from "#/components/q/menu";
import {
	CREATE_NOTE,
	DELETE_NOTE,
	DUPLICATE_NOTE,
	MOVE_NOTE,
	NOTES,
	type NoteItem,
} from "#/graphql/note-operations";
import {
	ancestors,
	childrenOf,
	type DropSpot,
	dropTarget,
} from "#/lib/note-tree";
import { toast } from "#/lib/toast";
import { cn } from "#/lib/utils";

// The Notes section of the sidebar: pages nest like Notion's, open and close with the
// chevron, and drag onto a page (inside) or its top/bottom edge (reorder).

const openKey = (slug: string) => `zadaci.notes-open.${slug}`;

export const noteTitle = (n: { title: string }) => n.title || "Untitled";

export function NoteIcon({ note }: { note: { icon: string | null } }) {
	return note.icon ? (
		<span className="nicon" aria-hidden="true">
			{note.icon}
		</span>
	) : (
		<span
			className="i icon-[solar--document-text-linear] size-4 shrink-0"
			aria-hidden="true"
		/>
	);
}

/** Create a page (optionally inside another) and open it. */
export function useCreateNote(slug: string) {
	const navigate = useNavigate();
	const [createNote] = useMutation(CREATE_NOTE, {
		update: (cache, { data }) => {
			const note = data?.createNote;
			if (!note) return;
			cache.updateQuery({ query: NOTES, variables: { slug } }, (prev) =>
				prev ? { notes: [...prev.notes, note] } : prev,
			);
		},
	});
	return async (parentId: string | null = null) => {
		try {
			const { data } = await createNote({
				variables: { slug, input: { parentId } },
			});
			const note = data?.createNote;
			if (note)
				navigate({
					to: "/w/$slug/notes/$noteId",
					params: { slug, noteId: note.id },
				});
			return note;
		} catch (error) {
			toast.error("Couldn't add the page", { desc: (error as Error).message });
		}
	};
}

type DragState = { id: string; over?: string; spot?: DropSpot } | undefined;

export function NotesTree({ slug }: { slug: string }) {
	const { data } = useQuery(NOTES, { variables: { slug } });
	const notes = useMemo(() => data?.notes ?? [], [data]);
	const tree = useMemo(() => childrenOf(notes), [notes]);
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const activeId = pathname.match(/\/notes\/([^/]+)/)?.[1];
	const create = useCreateNote(slug);
	const [open, setOpen] = useState<Record<string, boolean>>({});
	const [drag, setDrag] = useState<DragState>();

	useEffect(() => {
		try {
			setOpen(JSON.parse(localStorage.getItem(openKey(slug)) ?? "{}"));
		} catch {}
	}, [slug]);
	const setOpenFor = (ids: string[], value: boolean) =>
		setOpen((prev) => {
			const next = { ...prev };
			for (const id of ids) next[id] = value;
			try {
				localStorage.setItem(openKey(slug), JSON.stringify(next));
			} catch {}
			return next;
		});

	// the open page's parents unfold so it shows in the tree
	// biome-ignore lint/correctness/useExhaustiveDependencies: unfold when the page or the list changes
	useEffect(() => {
		if (activeId)
			setOpenFor(
				ancestors(notes, activeId).map((n) => n.id),
				true,
			);
	}, [activeId, notes]);

	const [moveNote] = useMutation(MOVE_NOTE);
	const onDrop = (target: NoteItem, spot: DropSpot) => {
		const dragged = notes.find((n) => n.id === drag?.id);
		setDrag(undefined);
		if (!dragged || dragged.id === target.id) return;
		// a page can't go inside itself or one of its sub-pages
		if (ancestors(notes, target.id).some((n) => n.id === dragged.id)) return;
		const to = dropTarget(tree, target, spot);
		if (spot === "inside") setOpenFor([target.id], true);
		moveNote({
			variables: { slug, id: dragged.id, ...to },
			optimisticResponse: { moveNote: { ...dragged, ...to } },
		}).catch((error: Error) =>
			toast.error("Couldn't move the page", { desc: error.message }),
		);
	};

	const rows = (parentId: string | null, depth: number): ReactNode =>
		(tree.get(parentId) ?? []).map((note) => (
			<Row
				key={note.id}
				slug={slug}
				note={note}
				depth={depth}
				on={note.id === activeId}
				hasKids={!!tree.get(note.id)?.length}
				open={!!open[note.id]}
				onToggle={() => setOpenFor([note.id], !open[note.id])}
				onAdd={() => {
					setOpenFor([note.id], true);
					void create(note.id);
				}}
				drag={drag}
				setDrag={setDrag}
				onDrop={onDrop}
			>
				{open[note.id] && rows(note.id, depth + 1)}
			</Row>
		));

	return (
		<div className="sgroup" id="side-notes">
			<div className="sgroup-h">
				<span>Notes</span>
				<span className="sp" />
				<button
					type="button"
					className="ibtn ibtn-xs"
					aria-label="New page"
					data-tip="New page"
					onClick={() => void create(null)}
				>
					<span
						className="icon-[hugeicons--plus-sign] size-3.5"
						aria-hidden="true"
					/>
				</button>
			</div>
			{/* pages load after the sidebar; hold their place */}
			{!data &&
				[70, 55, 62].map((w) => (
					<div
						key={w}
						className="sitem"
						style={{ cursor: "default" }}
						aria-hidden="true"
					>
						<span
							className="sk"
							style={{ width: 14, height: 14, borderRadius: 4 }}
						/>
						<span className="sk" style={{ width: `${w}%`, height: 11 }} />
					</div>
				))}
			{rows(null, 0)}
			{data && !notes.length && (
				<button
					type="button"
					className="sitem"
					onClick={() => void create(null)}
				>
					<span
						className="i icon-[hugeicons--plus-sign] size-3.5"
						aria-hidden="true"
					/>
					<span className="faint">Add a page</span>
				</button>
			)}
		</div>
	);
}

function Row({
	slug,
	note,
	depth,
	on,
	hasKids,
	open,
	onToggle,
	onAdd,
	drag,
	setDrag,
	onDrop,
	children,
}: {
	slug: string;
	note: NoteItem;
	depth: number;
	on: boolean;
	hasKids: boolean;
	open: boolean;
	onToggle: () => void;
	onAdd: () => void;
	drag: DragState;
	setDrag: (d: DragState) => void;
	onDrop: (target: NoteItem, spot: DropSpot) => void;
	children: ReactNode;
}) {
	const spotOf = (e: DragEvent<HTMLDivElement>): DropSpot => {
		const box = e.currentTarget.getBoundingClientRect();
		const y = (e.clientY - box.top) / box.height;
		return y < 0.25 ? "before" : y > 0.75 ? "after" : "inside";
	};
	const over = drag?.over === note.id ? drag.spot : undefined;
	const title = noteTitle(note);

	return (
		<>
			{/* biome-ignore lint/a11y/noStaticElementInteractions: drag and drop; every action also has a button or menu item */}
			<div
				className={cn(
					"sitem snote",
					on && "on",
					drag?.id === note.id && "dragging",
					over && `drop-${over}`,
				)}
				style={{ paddingLeft: 4 + depth * 14 }}
				draggable={note.canEdit}
				onDragStart={(e) => {
					e.dataTransfer.effectAllowed = "move";
					setDrag({ id: note.id });
				}}
				onDragEnd={() => setDrag(undefined)}
				onDragOver={(e) => {
					if (!drag || drag.id === note.id) return;
					e.preventDefault();
					const spot = spotOf(e);
					if (drag.over !== note.id || drag.spot !== spot)
						setDrag({ ...drag, over: note.id, spot });
				}}
				onDrop={(e) => {
					e.preventDefault();
					onDrop(note, spotOf(e));
				}}
			>
				<button
					type="button"
					className="ibtn ibtn-xs ntog"
					aria-label={open ? `Collapse ${title}` : `Expand ${title}`}
					aria-expanded={open}
					onClick={onToggle}
				>
					<span
						className={cn(
							"chev icon-[solar--alt-arrow-right-linear] size-[13px]",
							open && "open",
						)}
						aria-hidden="true"
					/>
				</button>
				<Link
					to="/w/$slug/notes/$noteId"
					params={{ slug, noteId: note.id }}
					className="row grow"
					style={{ gap: 8, height: "100%", minWidth: 0 }}
					aria-current={on ? "page" : undefined}
					draggable={false}
				>
					<NoteIcon note={note} />
					<span className="trunc">{title}</span>
				</Link>
				<span className="hov">
					<NoteMenu slug={slug} note={note} onAdd={onAdd} />
					{note.canEdit && (
						<button
							type="button"
							className="ibtn ibtn-xs"
							aria-label={`Add a page inside ${title}`}
							onClick={onAdd}
						>
							<span
								className="icon-[hugeicons--plus-sign] size-3.5"
								aria-hidden="true"
							/>
						</button>
					)}
				</span>
			</div>
			{open && !hasKids && (
				<div
					className="sitem faint"
					style={{ paddingLeft: 30 + depth * 14, cursor: "default" }}
				>
					No pages inside
				</div>
			)}
			{children}
		</>
	);
}

/** The page "…" menu: add inside, duplicate, copy link, delete. */
export function NoteMenu({
	slug,
	note,
	onAdd,
	className = "ibtn ibtn-xs",
	children,
}: {
	slug: string;
	note: NoteItem;
	onAdd?: () => void;
	className?: string;
	/** extra items at the top (the page's own menu adds star, privacy and edited time) */
	children?: ReactNode;
}) {
	const navigate = useNavigate();
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const [deleting, setDeleting] = useState(false);
	const [duplicate] = useMutation(DUPLICATE_NOTE, {
		refetchQueries: ["Notes"],
	});
	const [deleteNote] = useMutation(DELETE_NOTE, { refetchQueries: ["Notes"] });

	return (
		<>
			<Menu>
				<MenuTrigger
					className={className}
					aria-label={`Options for ${noteTitle(note)}`}
				>
					<span
						className="icon-[solar--menu-dots-bold] size-3.5"
						aria-hidden="true"
					/>
				</MenuTrigger>
				<MenuContent width={240} align="end">
					{children}
					{note.canEdit && onAdd && (
						<MenuItem icon="icon-[hugeicons--plus-sign]" onSelect={onAdd}>
							Add a page inside
						</MenuItem>
					)}
					<MenuItem
						icon="icon-[solar--copy-linear]"
						onSelect={() => {
							toast
								.promise(duplicate({ variables: { slug, id: note.id } }), {
									loading: "Duplicating…",
									success: "Page duplicated",
									error: "Couldn't duplicate the page",
								})
								.catch(() => {});
						}}
					>
						Duplicate
					</MenuItem>
					<MenuItem
						icon="icon-[solar--link-linear]"
						onSelect={() => {
							navigator.clipboard
								.writeText(
									`${window.location.origin}/w/${slug}/notes/${note.id}`,
								)
								.then(() => toast.success("Link copied"))
								.catch(() => toast.error("Couldn't copy the link"));
						}}
					>
						Copy link
					</MenuItem>
					{note.canDelete && (
						<>
							<MenuSeparator />
							<MenuItem
								icon="icon-[solar--trash-bin-trash-linear]"
								danger
								onSelect={() => setDeleting(true)}
							>
								Delete
							</MenuItem>
						</>
					)}
				</MenuContent>
			</Menu>
			<ConfirmModal
				open={deleting}
				onOpenChange={setDeleting}
				title={`Delete “${noteTitle(note)}”?`}
				body="The page and every page inside it will be deleted."
				ok="Delete"
				danger
				icon="icon-[solar--trash-bin-trash-linear]"
				onConfirm={async () => {
					await toast.promise(
						deleteNote({ variables: { slug, id: note.id } }),
						{
							loading: "Deleting…",
							success: "Page deleted",
							error: "Couldn't delete the page",
						},
					);
					if (pathname.includes(`/notes/${note.id}`))
						navigate({ to: "/w/$slug", params: { slug } });
				}}
			/>
		</>
	);
}
