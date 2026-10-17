import { useSuspenseQuery } from "@apollo/client/react";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { NoteEditor } from "#/components/notes/note-editor";
import {
	NoteMenu,
	noteTitle,
	useCreateNote,
} from "#/components/notes/notes-tree";
import { NotePageSkeleton } from "#/components/shell/page-skeletons";
import { NOTE, NOTES } from "#/graphql/note-operations";
import { reloadOnEnter } from "#/lib/routing";
import { wsTitle } from "#/lib/seo";

// One page and its editor; the top bar shows its trail (Notes / parent pages / this page).

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
	// the menu follows the sidebar's live copy of the page while you type
	const live = notes.find((n) => n.id === note.id) ?? note;

	return (
		<div className="page note-wrap">
			{/* a fresh editor per page, so one page's unsaved state never leaks into another */}
			<NoteEditor
				key={note.id}
				slug={slug}
				note={note}
				live={live}
				menu={
					<NoteMenu
						slug={slug}
						note={live}
						onAdd={() => void create(note.id)}
						className="ibtn ibtn-sm"
					/>
				}
			/>
		</div>
	);
}
