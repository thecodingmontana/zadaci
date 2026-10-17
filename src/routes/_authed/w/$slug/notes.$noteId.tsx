import { useSuspenseQuery } from "@apollo/client/react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { NoteEditor } from "#/components/notes/note-editor";
import {
	NoteMenu,
	noteTitle,
	useCreateNote,
} from "#/components/notes/notes-tree";
import { NotePageSkeleton } from "#/components/shell/page-skeletons";
import { NOTE, NOTES } from "#/graphql/note-operations";
import { ancestors } from "#/lib/note-tree";
import { reloadOnEnter } from "#/lib/routing";
import { wsTitle } from "#/lib/seo";

// One page: breadcrumbs (Notes / parent pages / this page), its menu, and the editor.

export const Route = createFileRoute("/_authed/w/$slug/notes/$noteId")({
	shouldReload: reloadOnEnter,
	loader: async ({ context, params }) => {
		const variables = { slug: params.slug };
		const [{ data }] = await Promise.all([
			context.apolloClient.query({
				query: NOTE,
				variables: { ...variables, id: params.noteId },
				fetchPolicy: "network-only",
			}),
			context.apolloClient.query({ query: NOTES, variables }),
		]);
		if (!data?.note) throw notFound();
		return { title: noteTitle(data.note) };
	},
	head: ({ loaderData, matches }) => ({
		meta: [{ title: wsTitle(matches, loaderData?.title ?? "Note") }],
	}),
	pendingComponent: NotePageSkeleton,
	component: NotePage,
});

function NotePage() {
	const { slug, noteId } = Route.useParams();
	const { note } = useSuspenseQuery(NOTE, {
		variables: { slug, id: noteId },
	}).data;
	const { notes } = useSuspenseQuery(NOTES, { variables: { slug } }).data;
	const create = useCreateNote(slug);
	if (!note) return null;
	// the title in the crumbs follows the sidebar's live copy while you type
	const live = notes.find((n) => n.id === note.id) ?? note;

	return (
		<div className="page note-wrap">
			<div className="note-crumbs">
				<Link to="/w/$slug/notes" params={{ slug }} className="faint">
					Notes
				</Link>
				{ancestors(notes, note.id).map((n) => (
					<span key={n.id} className="row" style={{ gap: 6, minWidth: 0 }}>
						<span className="faint">/</span>
						<Link
							to="/w/$slug/notes/$noteId"
							params={{ slug, noteId: n.id }}
							className="faint trunc"
						>
							{noteTitle(n)}
						</Link>
					</span>
				))}
				<span className="faint">/</span>
				<span className="trunc">{noteTitle(live)}</span>
				<span className="grow" />
				<NoteMenu
					slug={slug}
					note={live}
					onAdd={() => void create(note.id)}
					className="ibtn"
				/>
			</div>
			{/* a fresh editor per page, so one page's unsaved state never leaks into another */}
			<NoteEditor key={note.id} slug={slug} note={note} />
		</div>
	);
}
