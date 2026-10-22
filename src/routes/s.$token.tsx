import { createFileRoute, Link } from "@tanstack/react-router";
import { ReadOnlyDoc } from "#/components/notes/read-only-doc";
import { StatusIcon } from "#/components/q/status-icon";
import { PUBLIC_SHARE } from "#/graphql/share-operations";
import { NOINDEX } from "#/lib/seo";
import { PRIORITIES, TASK_STATUSES } from "#/lib/tasks";

// What a public link shows: a page or a project board, read-only, to anyone who has the link.

export const Route = createFileRoute("/s/$token")({
	loader: async ({ context, params }) => {
		const { data } = await context.apolloClient.query({
			query: PUBLIC_SHARE,
			variables: { token: params.token },
			fetchPolicy: "network-only",
		});
		return { share: data?.publicShare ?? null };
	},
	head: ({ loaderData }) => ({
		meta: [
			NOINDEX,
			{
				title: loaderData?.share
					? `${loaderData.share.title || "Untitled"} · Zadaci`
					: "Link not available · Zadaci",
			},
		],
	}),
	component: SharedPage,
});

function SharedPage() {
	const { share } = Route.useLoaderData();
	if (!share)
		return (
			<div className="fullstate">
				<div className="box">
					<span className="code">LINK OFF</span>
					<h1>This link isn't available.</h1>
					<p>It was turned off, or the page was removed.</p>
					<div className="row">
						<Link to="/" className="btn btn-primary">
							Go to Zadaci
						</Link>
					</div>
				</div>
			</div>
		);
	return (
		<div className="shared">
			<header className="shared-top">
				<span className="faint">{share.workspace}</span>
				<a href="/" className="faint">
					Made with Zadaci
				</a>
			</header>
			{share.kind === "note" ? (
				<article className="note-page">
					{share.icon && <div className="note-icon">{share.icon}</div>}
					<h1 className="shared-title">{share.title || "Untitled"}</h1>
					<ReadOnlyDoc doc={share.doc} />
				</article>
			) : (
				<section className="shared-board">
					<h1 className="shared-title">{share.title}</h1>
					<div className="board">
						{TASK_STATUSES.map((s) => {
							const tasks = (share.tasks ?? []).filter(
								(t) => t.status === s.id,
							);
							return (
								<section key={s.id} className="bcol" aria-label={s.name}>
									<div className="bcol-h">
										<StatusIcon status={s.id} size={14} />
										{s.name}
										<span className="faint">{tasks.length}</span>
									</div>
									{tasks.map((t) => (
										<div key={t.key} className="kcard">
											<div style={{ fontWeight: 500 }}>{t.name}</div>
											<div
												className="faint"
												style={{ fontSize: 12, marginTop: 6 }}
											>
												{t.key}
												{t.dueDate && ` · Due ${t.dueDate}`}
												{t.priority !== "none" &&
													` · ${PRIORITIES.find((p) => p.id === t.priority)?.name ?? ""}`}
											</div>
										</div>
									))}
								</section>
							);
						})}
					</div>
				</section>
			)}
		</div>
	);
}
