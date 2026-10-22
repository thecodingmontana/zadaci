import { useMutation, useQuery } from "@apollo/client/react";
import {
	CREATE_SHARE_LINK,
	REVOKE_SHARE_LINK,
	SHARE_LINK,
} from "#/graphql/share-operations";
import { copy, toast } from "#/lib/toast";
import { cn } from "#/lib/utils";

// "Public link" in Share: a read-only link anyone can open, for pages and project boards.

export function PublicLink({
	slug,
	kind,
	id,
}: {
	slug: string;
	kind: "note" | "project";
	id: string;
}) {
	const vars = { slug, kind, id };
	const { data, loading } = useQuery(SHARE_LINK, {
		variables: vars,
		fetchPolicy: "cache-and-network",
	});
	const refetch = { refetchQueries: ["ShareLink"] };
	const [create, { loading: creating }] = useMutation(
		CREATE_SHARE_LINK,
		refetch,
	);
	const [revoke, { loading: revoking }] = useMutation(
		REVOKE_SHARE_LINK,
		refetch,
	);
	const link = data?.shareLink;
	const url = link ? `${location.origin}/s/${link.token}` : "";
	const what = kind === "note" ? "page" : "board";

	return (
		<div className="public-link">
			<div className="row" style={{ gap: 10, alignItems: "flex-start" }}>
				<span
					className="icon-[solar--global-linear] size-4"
					aria-hidden="true"
					style={{ marginTop: 2 }}
				/>
				<div className="grow" style={{ minWidth: 0 }}>
					<div style={{ fontWeight: 500 }}>Public link</div>
					<div className="faint" style={{ fontSize: 12 }}>
						{link
							? `Anyone with the link can view this ${what}. They can't edit, comment or see who's on it.`
							: `Make a read-only link to this ${what} for people outside the workspace.`}
					</div>
				</div>
				{!link && (
					<button
						type="button"
						className={cn("btn btn-secondary btn-sm", creating && "is-loading")}
						disabled={loading || creating}
						onClick={() =>
							create({ variables: vars })
								.then(({ data: d }) => {
									if (d)
										copy(`${location.origin}/s/${d.createShareLink.token}`);
								})
								.catch((error: Error) =>
									toast.error("Couldn't make a public link", {
										desc: error.message,
									}),
								)
						}
					>
						Create link
					</button>
				)}
			</div>
			{link && (
				<div className="row" style={{ gap: 6, marginTop: 10 }}>
					<input
						className="input grow"
						readOnly
						value={url}
						aria-label="Public link"
						onFocus={(e) => e.currentTarget.select()}
					/>
					<button
						type="button"
						className="btn btn-secondary btn-sm"
						onClick={() => copy(url)}
					>
						Copy
					</button>
					<button
						type="button"
						className={cn("btn btn-ghost btn-sm", revoking && "is-loading")}
						disabled={revoking}
						onClick={() =>
							toast
								.promise(revoke({ variables: vars }), {
									loading: "Turning the link off…",
									success: "The public link no longer works",
									error: "Couldn't turn the link off",
								})
								.catch(() => {})
						}
					>
						Turn off
					</button>
				</div>
			)}
		</div>
	);
}
