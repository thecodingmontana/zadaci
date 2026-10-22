import { useSuspenseQuery } from "@apollo/client/react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { BookmarkModal } from "#/components/bookmarks/bookmark-modal";
import { BOOKMARK_COLLECTIONS, BOOKMARKS } from "#/graphql/bookmark-operations";

// What the "Save to Zadaci" bookmarklet opens in a small window: the page's link, ready to
// file into a collection. Lives outside the workspace shell so the window stays small.

export const Route = createFileRoute("/_authed/save/$slug")({
	validateSearch: z.object({ url: z.string().max(2000).optional() }),
	loader: ({ context, params }) =>
		Promise.all([
			context.apolloClient.query({
				query: BOOKMARKS,
				variables: { slug: params.slug },
			}),
			context.apolloClient.query({
				query: BOOKMARK_COLLECTIONS,
				variables: { slug: params.slug },
			}),
		]),
	head: () => ({ meta: [{ title: "Save to Zadaci" }] }),
	component: SavePage,
});

function SavePage() {
	const { slug } = Route.useParams();
	const { url } = Route.useSearch();
	const { data } = useSuspenseQuery(BOOKMARKS, { variables: { slug } });
	const { data: cols } = useSuspenseQuery(BOOKMARK_COLLECTIONS, {
		variables: { slug },
	});
	const [state, setState] = useState<"open" | "saved" | "closed">("open");
	const allTags = [...new Set(data.bookmarks.flatMap((b) => b.tags))];
	// the bookmarklet opened this window, so it may close it; a normal tab just shows the message
	const done = (saved: boolean) => {
		setState(saved ? "saved" : "closed");
		if (saved) setTimeout(() => window.close(), 900);
	};

	return (
		<div className="fullstate">
			{state === "open" ? (
				<BookmarkModal
					slug={slug}
					open
					onOpenChange={(o) => !o && state === "open" && done(false)}
					onSaved={() => done(true)}
					collections={cols.bookmarkCollections}
					allTags={allTags}
					initialUrl={url}
				/>
			) : (
				<div className="box">
					<h1>{state === "saved" ? "Saved to Zadaci" : "Not saved"}</h1>
					<p>You can close this window.</p>
					<div className="row">
						<Link
							to="/w/$slug/bookmarks"
							params={{ slug }}
							className="btn btn-secondary"
						>
							Open bookmarks
						</Link>
					</div>
				</div>
			)}
		</div>
	);
}
