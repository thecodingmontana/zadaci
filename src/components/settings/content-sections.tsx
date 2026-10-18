import { useMutation, useQuery } from "@apollo/client/react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { REFETCH } from "#/components/bookmarks/bookmark-card";
import {
	CollectionIcon,
	CollectionMenu,
	CollectionModal,
} from "#/components/bookmarks/collection-modal";
import { NoteIcon, NoteMenu, noteTitle } from "#/components/notes/notes-tree";
import { ConfirmModal } from "#/components/q/confirm";
import {
	ARCHIVE_BOOKMARK,
	BOOKMARK_COLLECTIONS,
	BOOKMARKS,
	type BookmarkItem,
	DELETE_BOOKMARK,
} from "#/graphql/bookmark-operations";
import { NOTES } from "#/graphql/note-operations";
import { SHELL } from "#/graphql/operations";
import { can } from "#/lib/permissions";
import { toast } from "#/lib/toast";
import type { SectionProps } from "./general";
import { SBlock, SettingsHeader, SRow } from "./ui";

// Settings for the workspace's notes, bookmarks and collections: what's there, who can
// add to it, and the cleanup that would otherwise mean hunting through the pages.

const Empty = ({ text }: { text: string }) => (
	<p className="faint" style={{ fontSize: 13, padding: "10px 0" }}>
		{text}
	</p>
);

function WhoCanAdd({
	slug,
	workspace,
}: Pick<SectionProps, "slug" | "workspace">) {
	const guests = can("guest", "workspaceContent", workspace.settings);
	const members = can("member", "workspaceContent", workspace.settings);
	return (
		<SRow
			t="Who can add outside projects"
			d={
				<>
					Inside a project, it follows the project's access.{" "}
					<Link
						to="/w/$slug/settings"
						params={{ slug }}
						search={{ sec: "permissions" }}
					>
						Change in Permissions
					</Link>
				</>
			}
		>
			<span className="muted" style={{ fontSize: 13 }}>
				{guests
					? "Everyone, guests too"
					: members
						? "Everyone but guests"
						: "Admins only"}
			</span>
		</SRow>
	);
}

export function NotesSection({ slug, workspace, title }: SectionProps) {
	const { data } = useQuery(NOTES, { variables: { slug } });
	const notes = data?.notes ?? [];
	const top = notes.filter((n) => !n.parentId);
	const inside = (id: string) => notes.filter((n) => n.parentId === id).length;
	return (
		<>
			<SettingsHeader
				title={title}
				lead="Pages your workspace keeps, and who can add them."
			/>
			<WhoCanAdd slug={slug} workspace={workspace} />
			<SRow t="Pages you can see">
				<span className="num muted">{data ? notes.length : "…"}</span>
			</SRow>
			<SBlock title="Top-level pages">
				{data && !top.length && <Empty text="No pages yet." />}
				{top.map((n) => (
					<div key={n.id} className="srow">
						<Link
							to="/w/$slug/notes/$noteId"
							params={{ slug, noteId: n.id }}
							className="row"
							style={{ gap: 8, minWidth: 0 }}
						>
							<NoteIcon note={n} />
							<b className="trunc" style={{ fontWeight: 500 }}>
								{noteTitle(n)}
							</b>
							{n.isPrivate && (
								<span
									className="icon-[solar--lock-keyhole-linear] size-3 faint"
									role="img"
									aria-label="Private"
								/>
							)}
						</Link>
						<div className="row">
							{inside(n.id) > 0 && (
								<span className="faint" style={{ fontSize: 12 }}>
									{inside(n.id)} inside
								</span>
							)}
							<NoteMenu slug={slug} note={n} className="ibtn ibtn-sm" />
						</div>
					</div>
				))}
			</SBlock>
		</>
	);
}

export function BookmarksSection({ slug, workspace, title }: SectionProps) {
	const { data } = useQuery(BOOKMARKS, { variables: { slug } });
	const bookmarks = data?.bookmarks ?? [];
	const archived = bookmarks.filter((b) => b.archivedAt);
	const [deleting, setDeleting] = useState<BookmarkItem>();
	const [archive] = useMutation(ARCHIVE_BOOKMARK, { refetchQueries: REFETCH });
	const [remove] = useMutation(DELETE_BOOKMARK, { refetchQueries: REFETCH });
	const count = (kind: string, word: string) => {
		const n = bookmarks.filter((b) => !b.archivedAt && b.kind === kind).length;
		return `${n} ${word}${n === 1 ? "" : "s"}`;
	};
	return (
		<>
			<SettingsHeader
				title={title}
				lead="Saved links, and the ones archived out of the way."
			/>
			<WhoCanAdd slug={slug} workspace={workspace} />
			<SRow
				t="Bookmarks you can see"
				d={`${count("article", "article")} · ${count("document", "document")} · ${count("video", "video")}`}
			>
				<Link
					to="/w/$slug/bookmarks"
					params={{ slug }}
					className="btn btn-secondary btn-sm"
				>
					Open bookmarks
				</Link>
			</SRow>
			<SBlock title="Archived bookmarks">
				{data && !archived.length && <Empty text="Nothing archived." />}
				{archived.map((b) => (
					<div key={b.id} className="srow">
						<div style={{ minWidth: 0 }}>
							<a
								href={b.url}
								target="_blank"
								rel="noopener noreferrer"
								className="trunc"
								style={{ fontWeight: 500, display: "block" }}
							>
								{b.title}
							</a>
							<span className="faint" style={{ fontSize: 12 }}>
								{b.site}
							</span>
						</div>
						<div className="row">
							{b.canEdit && (
								<button
									type="button"
									className="btn btn-secondary btn-sm"
									onClick={() =>
										toast
											.promise(
												archive({
													variables: { slug, id: b.id, archived: false },
												}),
												{
													loading: "Restoring…",
													success: "Restored",
													error: "Couldn't restore it",
												},
											)
											.catch(() => {})
									}
								>
									Restore
								</button>
							)}
							{b.canDelete && (
								<button
									type="button"
									className="btn btn-danger-ghost btn-sm"
									onClick={() => setDeleting(b)}
								>
									Delete
								</button>
							)}
						</div>
					</div>
				))}
			</SBlock>
			<ConfirmModal
				open={!!deleting}
				onOpenChange={(o) => !o && setDeleting(undefined)}
				title={`Delete “${deleting?.title ?? ""}”?`}
				body="The bookmark will be removed from every collection."
				ok="Delete"
				danger
				icon="icon-[solar--trash-bin-trash-linear]"
				onConfirm={() =>
					deleting &&
					toast.promise(remove({ variables: { slug, id: deleting.id } }), {
						loading: "Deleting…",
						success: "Bookmark deleted",
						error: "Couldn't delete the bookmark",
					})
				}
			/>
		</>
	);
}

export function CollectionsSection({ slug, workspace, title }: SectionProps) {
	const { data } = useQuery(BOOKMARK_COLLECTIONS, { variables: { slug } });
	const { data: shell } = useQuery(SHELL, { variables: { slug } });
	const [creating, setCreating] = useState(false);
	const collections = data?.bookmarkCollections ?? [];
	const projectName = (id: string) =>
		shell?.workspace?.projects.find((p) => p.id === id)?.title ?? "a project";
	return (
		<>
			<SettingsHeader
				title={title}
				lead="Folders of saved links, and who can see each one."
			/>
			<WhoCanAdd slug={slug} workspace={workspace} />
			<SBlock title="Collections">
				{data && !collections.length && <Empty text="No collections yet." />}
				{collections.map((c) => (
					<div key={c.id} className="srow">
						<Link
							to="/w/$slug/bookmarks"
							params={{ slug }}
							search={{ c: c.id }}
							className="row"
							style={{ gap: 8, minWidth: 0 }}
						>
							<CollectionIcon c={c} />
							<b className="trunc" style={{ fontWeight: 500 }}>
								{c.name}
							</b>
						</Link>
						<div className="row">
							<span className="faint" style={{ fontSize: 12 }}>
								{c.isPrivate
									? "Only you"
									: c.projectId
										? `People in ${projectName(c.projectId)}`
										: "Everyone in the workspace"}{" "}
								· {c.count} {c.count === 1 ? "bookmark" : "bookmarks"}
							</span>
							<CollectionMenu
								slug={slug}
								collection={c}
								className="ibtn ibtn-sm"
							/>
						</div>
					</div>
				))}
				<div style={{ marginTop: 10 }}>
					<button
						type="button"
						className="btn btn-secondary btn-sm"
						onClick={() => setCreating(true)}
					>
						<span
							className="icon-[hugeicons--plus-sign] size-3.5"
							aria-hidden="true"
						/>
						New collection
					</button>
				</div>
			</SBlock>
			{creating && (
				<CollectionModal
					slug={slug}
					open={creating}
					onOpenChange={setCreating}
				/>
			)}
		</>
	);
}
