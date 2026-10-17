import { useSuspenseQuery } from "@apollo/client/react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	NoteIcon,
	noteTitle,
	useCreateNote,
} from "#/components/notes/notes-tree";
import { NotesSkeleton } from "#/components/shell/page-skeletons";
import { NOTES } from "#/graphql/note-operations";
import { ancestors } from "#/lib/note-tree";
import { reloadOnEnter } from "#/lib/routing";
import { wsTitle } from "#/lib/seo";

// All pages, most recently edited first. The sidebar holds the tree; this is the overview.

export const Route = createFileRoute("/_authed/w/$slug/notes/")({
	shouldReload: reloadOnEnter,
	loader: ({ context, params }) =>
		context.apolloClient.query({
			query: NOTES,
			variables: { slug: params.slug },
			fetchPolicy: "network-only",
		}),
	head: ({ matches }) => ({ meta: [{ title: wsTitle(matches, "Notes") }] }),
	pendingComponent: NotesSkeleton,
	component: NotesPage,
});

const edited = (iso: string) =>
	new Date(iso).toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
	});

function NotesPage() {
	const { slug } = Route.useParams();
	const { notes } = useSuspenseQuery(NOTES, { variables: { slug } }).data;
	const create = useCreateNote(slug);
	const recent = [...notes].sort((a, b) =>
		b.updatedAt.localeCompare(a.updatedAt),
	);

	return (
		<div className="page wide">
			<div className="ph">
				<div>
					<h1>Notes</h1>
					<p>
						Pages for your team's docs, specs and meeting notes. Put pages
						inside pages to group them.
					</p>
				</div>
				<button
					type="button"
					className="btn btn-primary btn-sm"
					onClick={() => void create()}
				>
					<span
						className="icon-[hugeicons--plus-sign] size-3.5"
						aria-hidden="true"
					/>
					New page
				</button>
			</div>
			{!notes.length ? (
				<div className="panel">
					<div className="empty-state">
						<div className="glyph">
							<span
								className="icon-[solar--notebook-linear] size-5"
								aria-hidden="true"
							/>
						</div>
						<h2 className="es-h">No pages yet</h2>
						<p>Write your first page. Put pages inside pages to group them.</p>
						<button
							type="button"
							className="btn btn-secondary btn-sm"
							onClick={() => void create()}
						>
							New page
						</button>
					</div>
				</div>
			) : (
				<div className="panel note-list">
					{recent.map((n) => {
						const path = ancestors(notes, n.id).map(noteTitle).join(" / ");
						return (
							<Link
								key={n.id}
								to="/w/$slug/notes/$noteId"
								params={{ slug, noteId: n.id }}
								className="note-row"
							>
								<NoteIcon note={n} />
								<div className="grow" style={{ minWidth: 0 }}>
									<div className="trunc" style={{ fontWeight: 500 }}>
										{noteTitle(n)}
									</div>
									<div className="faint trunc" style={{ fontSize: 12 }}>
										{path ? `${path} · ` : ""}
										{n.excerpt || "Empty page"}
									</div>
								</div>
								<span className="faint" style={{ fontSize: 12, flexShrink: 0 }}>
									{edited(n.updatedAt)}
								</span>
							</Link>
						);
					})}
				</div>
			)}
		</div>
	);
}
