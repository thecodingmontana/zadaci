import { useMutation } from "@apollo/client/react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ContextMenu } from "radix-ui";
import { type FormEvent, useState } from "react";
import { ConfirmModal } from "#/components/q/confirm";
import { Modal } from "#/components/q/modal";
import { Select } from "#/components/settings/ui";
import {
	DELETE_VIEW,
	RENAME_VIEW,
	SAVE_VIEW,
	type SavedView,
} from "#/graphql/operations";
import { toast } from "#/lib/toast";
import { cn } from "#/lib/utils";
import type { Filter } from "#/lib/view-engine";

// Saved views: filters kept as extra project tabs (reference saveView modal and the
// "savedview" context menu on those tabs).

const REFETCH = { refetchQueries: ["ProjectPage"] };

/** The filters the project's own views are using right now (remembered in this browser). */
function currentFilters(projectId: string): Filter[] {
	try {
		const saved = localStorage.getItem(`zadaci:view:p:${projectId}`);
		return saved ? ((JSON.parse(saved).filters ?? []) as Filter[]) : [];
	} catch {
		return [];
	}
}

export function SavedViewTab({
	slug,
	projectId,
	view,
	on,
	editable,
}: {
	slug: string;
	projectId: string;
	view: SavedView;
	on: boolean;
	editable: boolean;
}) {
	const navigate = useNavigate();
	const [renaming, setRenaming] = useState(false);
	const [name, setName] = useState(view.name);
	const [deleting, setDeleting] = useState(false);
	const [rename, { loading }] = useMutation(RENAME_VIEW, REFETCH);
	const [remove] = useMutation(DELETE_VIEW, REFETCH);
	const link = (
		<Link
			to="/w/$slug/p/$projectId"
			params={{ slug, projectId }}
			search={{ tab: `v:${view.id}` }}
			className={cn("tab", on && "on")}
			aria-current={on ? "page" : undefined}
		>
			<span className="icon-[hugeicons--filter] size-3.5" aria-hidden="true" />
			{view.name}
		</Link>
	);
	if (!editable) return link;
	return (
		<>
			<ContextMenu.Root>
				<ContextMenu.Trigger asChild>{link}</ContextMenu.Trigger>
				<ContextMenu.Portal>
					<ContextMenu.Content
						className="pop enter"
						style={{ position: "relative", width: 190 }}
					>
						<ContextMenu.Item
							className="mi"
							onSelect={() => {
								setName(view.name);
								setRenaming(true);
							}}
						>
							<span
								className="i icon-[solar--pen-linear] size-[15px]"
								aria-hidden="true"
							/>
							Rename view
						</ContextMenu.Item>
						<ContextMenu.Item
							className="mi danger"
							onSelect={() => setDeleting(true)}
						>
							<span
								className="i icon-[solar--trash-bin-minimalistic-linear] size-[15px]"
								aria-hidden="true"
							/>
							Delete view
						</ContextMenu.Item>
					</ContextMenu.Content>
				</ContextMenu.Portal>
			</ContextMenu.Root>
			<Modal
				busy={loading}
				open={renaming}
				onOpenChange={setRenaming}
				title="Rename view"
				size="sm"
				footer={
					<>
						<span className="sp" />
						<button
							type="button"
							className="btn btn-secondary"
							onClick={() => setRenaming(false)}
						>
							Cancel
						</button>
						<button
							type="submit"
							form={`rv-${view.id}`}
							className={cn("btn btn-primary", loading && "is-loading")}
							disabled={!name.trim()}
						>
							Save
						</button>
					</>
				}
			>
				<form
					id={`rv-${view.id}`}
					className="modal-b"
					onSubmit={async (e) => {
						e.preventDefault();
						try {
							await toast.promise(
								rename({
									variables: { slug, id: view.id, name: name.trim() },
								}),
								{
									loading: "Renaming view…",
									success: `Renamed to “${name.trim()}”`,
									error: "Couldn't rename the view",
								},
							);
							setRenaming(false);
						} catch {
							// the toast already shows why
						}
					}}
				>
					<div className="field">
						<label className="label" htmlFor={`rv-in-${view.id}`}>
							View name
						</label>
						<input
							className="input"
							id={`rv-in-${view.id}`}
							value={name}
							onChange={(e) => setName(e.target.value)}
							maxLength={100}
						/>
					</div>
				</form>
			</Modal>
			<ConfirmModal
				open={deleting}
				onOpenChange={setDeleting}
				title={`Delete “${view.name}”?`}
				body="The tab goes away; no tasks are changed."
				ok="Delete view"
				danger
				onConfirm={async () => {
					await toast.promise(remove({ variables: { slug, id: view.id } }), {
						loading: `Deleting “${view.name}”…`,
						success: `Deleted “${view.name}”`,
						error: "Couldn't delete the view",
					});
					if (on)
						navigate({
							to: "/w/$slug/p/$projectId",
							params: { slug, projectId },
							search: { tab: "board" },
						});
				}}
			/>
		</>
	);
}

/** "Save view": the current filters become a tab (reference saveView modal). */
export function SaveViewButton({
	slug,
	projectId,
}: {
	slug: string;
	projectId: string;
}) {
	const navigate = useNavigate();
	const [open, setOpen] = useState(false);
	const [name, setName] = useState("");
	const [type, setType] = useState("list");
	const [filters, setFilters] = useState<Filter[]>([]);
	const [save, { loading }] = useMutation(SAVE_VIEW, REFETCH);
	const nf = filters.filter((f) => f.v.length).length;

	async function submit(event?: FormEvent) {
		event?.preventDefault();
		if (!name.trim()) return;
		try {
			const { data } = await toast.promise(
				save({
					variables: { slug, projectId, name: name.trim(), type, filters },
				}),
				{
					loading: `Saving “${name.trim()}”…`,
					success: `Saved view “${name.trim()}”`,
					error: "Couldn't save the view",
				},
			);
			setOpen(false);
			if (data)
				navigate({
					to: "/w/$slug/p/$projectId",
					params: { slug, projectId },
					search: { tab: `v:${data.saveView.id}` },
				});
		} catch {
			// the toast already shows why
		}
	}

	return (
		<>
			<button
				type="button"
				className="tab"
				data-tip="Save current filters as a view"
				aria-label="Save view"
				onClick={() => {
					setName("");
					setType("list");
					setFilters(currentFilters(projectId));
					setOpen(true);
				}}
			>
				<span
					className="icon-[hugeicons--plus-sign] size-3.5"
					aria-hidden="true"
				/>
			</button>
			<Modal
				busy={loading}
				open={open}
				onOpenChange={setOpen}
				title="Save view"
				sub="Save the current filters as a tab on this project."
				size="sm"
				footer={
					<>
						<span className="sp" />
						<button
							type="button"
							className="btn btn-secondary"
							onClick={() => setOpen(false)}
						>
							Cancel
						</button>
						<button
							type="submit"
							form="save-view"
							className={cn("btn btn-primary", loading && "is-loading")}
							disabled={!name.trim() || loading}
						>
							Save view
						</button>
					</>
				}
			>
				<form id="save-view" className="modal-b" onSubmit={submit}>
					<div className="field">
						<label className="label" htmlFor="sv-name">
							View name
						</label>
						<input
							className="input"
							id="sv-name"
							placeholder="e.g. Design review queue"
							value={name}
							onChange={(e) => setName(e.target.value)}
							maxLength={100}
							// biome-ignore lint/a11y/noAutofocus: the modal opens to type a name
							autoFocus
						/>
					</div>
					<div className="field">
						<span className="label">Layout</span>
						<Select
							label="Layout"
							value={type}
							options={[
								["list", "List"],
								["board", "Board"],
								["table", "Table"],
							]}
							onChange={setType}
							className="w-full"
						/>
					</div>
					{nf ? (
						<div className="hint">
							{nf} filter{nf > 1 ? "s" : ""} will be saved with this view.
						</div>
					) : (
						<div className="alert info">
							<span
								className="i icon-[solar--info-circle-linear] size-3.5"
								aria-hidden="true"
							/>
							<span>
								No filters are active — the view will show all tasks. You can
								add filters after saving.
							</span>
						</div>
					)}
				</form>
			</Modal>
		</>
	);
}
