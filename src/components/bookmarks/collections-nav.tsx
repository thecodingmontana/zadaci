import { useQuery } from "@apollo/client/react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { SideTip } from "#/components/shell/side-tip";
import { BOOKMARK_COLLECTIONS } from "#/graphql/bookmark-operations";
import { cn } from "#/lib/utils";
import {
	CollectionIcon,
	CollectionMenu,
	CollectionModal,
	useCanCreateCollection,
} from "./collection-modal";

// The Collections section of the sidebar: each bookmark collection with its count.

export function CollectionsNav({ slug }: { slug: string }) {
	const { data } = useQuery(BOOKMARK_COLLECTIONS, { variables: { slug } });
	const collections = data?.bookmarkCollections ?? [];
	const navigate = useNavigate();
	const active = useRouterState({
		select: (s) =>
			s.location.pathname.endsWith("/bookmarks")
				? (s.location.search as { c?: string }).c
				: undefined,
	});
	const [creating, setCreating] = useState(false);
	const canCreate = useCanCreateCollection(slug);

	return (
		<div className="sgroup" id="side-collections">
			<div className="sgroup-h">
				<span>Collections</span>
				<span className="sp" />
				{canCreate && (
					<button
						type="button"
						className="ibtn ibtn-xs"
						aria-label="New collection"
						data-tip="New collection"
						onClick={() => setCreating(true)}
					>
						<span
							className="icon-[hugeicons--plus-sign] size-3.5"
							aria-hidden="true"
						/>
					</button>
				)}
			</div>
			{/* collections load after the sidebar; hold their place */}
			{!data &&
				[60, 72].map((w) => (
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
			{collections.map((c) => (
				<div key={c.id} className={cn("sitem snote", active === c.id && "on")}>
					<SideTip label={c.name}>
						<Link
							to="/w/$slug/bookmarks"
							params={{ slug }}
							search={{ c: c.id }}
							className="row grow"
							style={{ gap: 8, height: "100%", minWidth: 0 }}
							aria-current={active === c.id ? "page" : undefined}
						>
							<CollectionIcon c={c} />
							<span className="trunc">{c.name}</span>
							{c.isPrivate && (
								<span
									className="icon-[solar--lock-keyhole-linear] size-3 faint shrink-0"
									role="img"
									aria-label="Private"
								/>
							)}
						</Link>
					</SideTip>
					{c.count > 0 && <span className="ct">{c.count}</span>}
					<span className="hov">
						<CollectionMenu slug={slug} collection={c} />
					</span>
				</div>
			))}
			{data && !collections.length && canCreate && (
				<button
					type="button"
					className="sitem"
					onClick={() => setCreating(true)}
				>
					<span
						className="i icon-[hugeicons--plus-sign] size-3.5"
						aria-hidden="true"
					/>
					<span className="faint">Add a collection</span>
				</button>
			)}
			{creating && (
				<CollectionModal
					slug={slug}
					open={creating}
					onOpenChange={setCreating}
					onCreated={(c) =>
						navigate({
							to: "/w/$slug/bookmarks",
							params: { slug },
							search: { c: c.id },
						})
					}
				/>
			)}
		</div>
	);
}
