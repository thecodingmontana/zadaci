import { useMutation, useQuery } from "@apollo/client/react";
import { useNavigate } from "@tanstack/react-router";
import { type FormEvent, useId, useState } from "react";
import { ConfirmModal } from "#/components/q/confirm";
import { IconMenu } from "#/components/q/icon-menu";
import {
	Menu,
	MenuContent,
	MenuItem,
	MenuSeparator,
	MenuTrigger,
} from "#/components/q/menu";
import { Modal } from "#/components/q/modal";
import { Select } from "#/components/settings/ui";
import {
	type BookmarkCollectionItem,
	CREATE_BOOKMARK_COLLECTION,
	DELETE_BOOKMARK_COLLECTION,
	UPDATE_BOOKMARK_COLLECTION,
} from "#/graphql/bookmark-operations";
import { SHELL } from "#/graphql/operations";
import { can, hasRight } from "#/lib/permissions";
import { copy, toast } from "#/lib/toast";
import { cn } from "#/lib/utils";
import { REFETCH } from "./bookmark-card";

// Create or edit a bookmark collection: icon, name and who sees it (the workspace, only
// you, or a project's people), plus the collection's "…" menu.

const WORKSPACE = "workspace";
const PRIVATE = "private";

export function CollectionIcon({
	c,
}: {
	c: { icon: string | null } | undefined;
}) {
	return c?.icon ? (
		<span className="nicon" aria-hidden="true">
			{c.icon}
		</span>
	) : (
		<span
			className="i icon-[solar--folder-linear] size-4 shrink-0"
			aria-hidden="true"
		/>
	);
}

/** Can the viewer make a collection: open ones, or one linked to a project they edit. */
export function useCanCreateCollection(slug: string) {
	const { data } = useQuery(SHELL, { variables: { slug } });
	const w = data?.workspace;
	return (
		can(w?.role, "workspaceContent", w?.settings) ||
		!!w?.projects.some((p) => hasRight(p.myAccess, "edit"))
	);
}

export function CollectionModal({
	slug,
	open,
	onOpenChange,
	collection,
	onCreated,
}: {
	slug: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	collection?: BookmarkCollectionItem;
	onCreated?: (c: BookmarkCollectionItem) => void;
}) {
	const id = useId();
	const { data: shell } = useQuery(SHELL, { variables: { slug } });
	// guests only work inside projects
	const openToAll = can(
		shell?.workspace?.role,
		"workspaceContent",
		shell?.workspace?.settings,
	);
	const projects = (shell?.workspace?.projects ?? []).filter((p) =>
		hasRight(p.myAccess, "edit"),
	);
	const [name, setName] = useState(collection?.name ?? "");
	const [icon, setIcon] = useState(collection?.icon ?? null);
	const [share, setShare] = useState(
		collection?.projectId ??
			(collection?.isPrivate ? PRIVATE : openToAll ? WORKSPACE : ""),
	);
	const [err, setErr] = useState("");
	const [busy, setBusy] = useState(false);
	const [create] = useMutation(CREATE_BOOKMARK_COLLECTION, {
		refetchQueries: REFETCH,
	});
	const [update] = useMutation(UPDATE_BOOKMARK_COLLECTION, {
		refetchQueries: REFETCH,
	});
	// only the author can make a collection private
	const canPrivate = !collection || collection.isAuthor;
	const options = [
		...(openToAll ? [[WORKSPACE, "Everyone in the workspace"] as const] : []),
		...(canPrivate ? [[PRIVATE, "Only me"] as const] : []),
		...projects.map((p) => [p.id, `People in ${p.title}`] as const),
	];

	const submit = async (e: FormEvent) => {
		e.preventDefault();
		if (!name.trim()) return setErr("Name the collection");
		if (!share) return setErr("Pick a project to share it with");
		setBusy(true);
		const fields = {
			name: name.trim(),
			icon,
			isPrivate: share === PRIVATE,
			projectId: share === WORKSPACE || share === PRIVATE ? null : share,
		};
		try {
			if (collection) {
				await update({
					variables: {
						slug,
						id: collection.id,
						patch: {
							name: fields.name,
							icon,
							...(collection.canDelete && { projectId: fields.projectId }),
							...(canPrivate && { isPrivate: fields.isPrivate }),
						},
					},
				});
				toast.success("Collection saved");
			} else {
				const { data } = await create({ variables: { slug, input: fields } });
				if (data) onCreated?.(data.createBookmarkCollection);
				toast.success("Collection created");
			}
			onOpenChange(false);
		} catch (error) {
			setErr((error as Error).message);
		} finally {
			setBusy(false);
		}
	};

	return (
		<Modal
			open={open}
			onOpenChange={onOpenChange}
			busy={busy}
			size="sm"
			title={collection ? "Edit collection" : "New collection"}
			sub={
				collection ? undefined : "Group saved links, for yourself or the team."
			}
			footer={
				<>
					<span className="sp" />
					<button
						type="button"
						className="btn btn-secondary"
						onClick={() => onOpenChange(false)}
					>
						Cancel
					</button>
					<button
						type="submit"
						form={`${id}-form`}
						className={cn("btn btn-primary", busy && "is-loading")}
						disabled={busy}
					>
						{collection ? "Save changes" : "Create collection"}
					</button>
				</>
			}
		>
			<form id={`${id}-form`} className="modal-b" onSubmit={submit}>
				<div className="field">
					<label className="label" htmlFor={`${id}-name`}>
						Name
					</label>
					<div className="row" style={{ gap: 8 }}>
						<IconMenu icon={icon} onPick={setIcon}>
							<button
								type="button"
								className="btn btn-secondary"
								style={{ width: 30, padding: 0, justifyContent: "center" }}
								aria-label={icon ? `Icon ${icon}, change` : "Pick an icon"}
							>
								<CollectionIcon c={{ icon }} />
							</button>
						</IconMenu>
						<input
							id={`${id}-name`}
							className={cn("input grow", err && "is-error")}
							value={name}
							maxLength={100}
							placeholder="e.g. Design inspiration"
							onChange={(e) => {
								setName(e.target.value);
								if (err) setErr("");
							}}
							aria-invalid={!!err}
							aria-describedby={err ? `${id}-err` : undefined}
							// biome-ignore lint/a11y/noAutofocus: the dialog opens to type a name
							autoFocus
						/>
					</div>
					{err && (
						<span className="err" id={`${id}-err`} role="alert">
							<span
								className="icon-[solar--danger-circle-linear] size-3"
								aria-hidden="true"
							/>
							{err}
						</span>
					)}
				</div>
				<div className="field">
					<span className="label">Who can see it</span>
					<Select
						label="Who can see it"
						value={share}
						options={share ? options : [["", "Pick a project"], ...options]}
						onChange={setShare}
						disabled={!!collection && !collection.canDelete && !canPrivate}
					/>
				</div>
			</form>
		</Modal>
	);
}

/** The collection's "…" menu: edit, copy link, delete. */
export function CollectionMenu({
	slug,
	collection,
	className = "ibtn ibtn-xs",
}: {
	slug: string;
	collection: BookmarkCollectionItem;
	className?: string;
}) {
	const navigate = useNavigate();
	const [editing, setEditing] = useState(false);
	const [deleting, setDeleting] = useState(false);
	const [remove] = useMutation(DELETE_BOOKMARK_COLLECTION, {
		refetchQueries: REFETCH,
	});
	return (
		<>
			<Menu>
				<MenuTrigger
					className={className}
					aria-label={`Options for ${collection.name}`}
				>
					<span
						className="icon-[solar--menu-dots-bold] size-3.5"
						aria-hidden="true"
					/>
				</MenuTrigger>
				<MenuContent width={200}>
					{collection.canEdit && (
						<MenuItem
							icon="icon-[solar--pen-2-linear]"
							onSelect={() => setEditing(true)}
						>
							Edit
						</MenuItem>
					)}
					<MenuItem
						icon="icon-[solar--link-linear]"
						onSelect={() =>
							copy(
								`${window.location.origin}/w/${slug}/bookmarks?c=${collection.id}`,
							)
						}
					>
						Copy link
					</MenuItem>
					{collection.canDelete && (
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
			{editing && (
				<CollectionModal
					slug={slug}
					open={editing}
					onOpenChange={setEditing}
					collection={collection}
				/>
			)}
			<ConfirmModal
				open={deleting}
				onOpenChange={setDeleting}
				title={`Delete “${collection.name}”?`}
				body="Bookmarks that are only in this collection are deleted with it. Ones filed in other collections stay there."
				ok="Delete"
				danger
				icon="icon-[solar--trash-bin-trash-linear]"
				onConfirm={async () => {
					await toast.promise(
						remove({ variables: { slug, id: collection.id } }),
						{
							loading: "Deleting…",
							success: "Collection deleted",
							error: "Couldn't delete the collection",
						},
					);
					navigate({ to: "/w/$slug/bookmarks", params: { slug } });
				}}
			/>
		</>
	);
}
