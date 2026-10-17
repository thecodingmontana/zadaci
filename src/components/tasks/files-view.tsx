import { useApolloClient, useMutation, useQuery } from "@apollo/client/react";
import { useRouter } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import { ConfirmModal } from "#/components/q/confirm";
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
	PROJECT_FILES,
	REMOVE_ATTACHMENT,
	RENAME_ATTACHMENT,
	type SettingsMember,
	type TaskAttachment,
} from "#/graphql/operations";
import { FILE_TYPES, type FileKind, fileKind, fmtSize } from "#/lib/files";
import { hasRight, type ProjectRight } from "#/lib/permissions";
import { ago } from "#/lib/time";
import { toast } from "#/lib/toast";
import { cn } from "#/lib/utils";
import { TASK_REFETCH } from "./context";
import { uploadFile } from "./upload";

// The project Files tab (reference views/files.js): every file on the project and its
// tasks, with upload, search, type filter, sort, and grid or list layout.

type Upload = { id: string; name: string; pct: number };
const REFETCH = { refetchQueries: ["ProjectFiles", ...TASK_REFETCH] };

export function FilesView({
	slug,
	projectId,
	members,
}: {
	slug: string;
	projectId: string;
	members: SettingsMember[];
}) {
	const router = useRouter();
	const client = useApolloClient();
	const { data } = useQuery(PROJECT_FILES, {
		variables: { slug, projectId },
		fetchPolicy: "cache-and-network",
	});
	const [q, setQ] = useState("");
	const [kind, setKind] = useState<"all" | FileKind>("all");
	const [sort, setSort] = useState<"date" | "name" | "type">("date");
	const [layout, setLayout] = useState<"grid" | "list">("grid");
	const [preview, setPreview] = useState<TaskAttachment | null>(null);
	const [uploads, setUploads] = useState<Upload[]>([]);
	const project = data?.workspace?.project;
	const editable = hasRight(
		(project?.myAccess ?? null) as ProjectRight | null,
		"edit",
	);
	const files = (project?.attachments ?? [])
		.filter(
			(f) =>
				(!q || f.name.toLowerCase().includes(q.toLowerCase())) &&
				(kind === "all" || fileKind(f.name) === kind),
		)
		.sort((a, b) =>
			sort === "name"
				? a.name.localeCompare(b.name)
				: sort === "type"
					? fileKind(a.name).localeCompare(fileKind(b.name))
					: b.createdAt.localeCompare(a.createdAt),
		);
	const who = (id: string | null) =>
		members.find((m) => m.id === id)?.name.split(" ")[0] ?? "Someone";
	const openTask = (id: string) =>
		router.navigate({
			to: ".",
			search: ((prev: Record<string, unknown>) => ({
				...prev,
				task: id,
			})) as never,
		});

	async function upload(list: FileList | File[]) {
		for (const file of list) {
			const id = crypto.randomUUID();
			setUploads((u) => [...u, { id, name: file.name, pct: 0 }]);
			try {
				await uploadFile(client, slug, { projectId }, file, (pct) =>
					setUploads((u) => u.map((x) => (x.id === id ? { ...x, pct } : x))),
				);
			} catch (error) {
				toast.error(`Couldn't upload ${file.name}`, {
					desc: (error as Error).message,
				});
			} finally {
				setUploads((u) => u.filter((x) => x.id !== id));
			}
		}
		await client.refetchQueries({ include: ["ProjectFiles"] });
	}
	const picker = (
		body: ReactNode,
		className: string,
		style?: React.CSSProperties,
	) => (
		<label className={className} style={{ cursor: "pointer", ...style }}>
			{body}
			<input
				type="file"
				multiple
				hidden
				onChange={(e) => e.target.files && upload(e.target.files)}
			/>
		</label>
	);
	const filtered = !!q || kind !== "all";

	return (
		<>
			<div className="toolbar">
				<div className="inwrap">
					<span
						className="i icon-[solar--magnifer-linear] size-[13px]"
						aria-hidden="true"
					/>
					<input
						className="input search-sm"
						placeholder="Search files"
						aria-label="Search files"
						value={q}
						onChange={(e) => setQ(e.target.value)}
					/>
				</div>
				<Select
					label="Filter by type"
					value={kind}
					options={[
						["all", "All types"],
						...(
							Object.entries(FILE_TYPES) as [
								FileKind,
								(typeof FILE_TYPES)[FileKind],
							][]
						)
							.filter(([k]) => k !== "other")
							.map(([k, v]) => [k, v.name] as const),
					]}
					onChange={(v) => setKind(v as typeof kind)}
					className="h-[26px] w-auto min-w-0 text-xs"
				/>
				<Select
					label="Sort"
					value={sort}
					options={[
						["date", "Sort: Newest"],
						["name", "Sort: Name"],
						["type", "Sort: Type"],
					]}
					onChange={(v) => setSort(v as typeof sort)}
					className="h-[26px] w-auto min-w-0 text-xs"
				/>
				<span className="sp" />
				<div className="seg">
					{(
						[
							["grid", "icon-[solar--widget-linear]"],
							["list", "icon-[solar--list-linear]"],
						] as const
					).map(([k, icon]) => (
						<button
							key={k}
							type="button"
							className={layout === k ? "on" : ""}
							aria-label={`${k} view`}
							onClick={() => setLayout(k)}
						>
							<span className={cn(icon, "size-[13px]")} aria-hidden="true" />
						</button>
					))}
				</div>
				{editable &&
					picker(
						<>
							<span
								className="icon-[solar--upload-linear] size-[13px]"
								aria-hidden="true"
							/>
							Upload
						</>,
						"btn btn-primary btn-sm",
					)}
			</div>
			<div className="page wide" style={{ paddingTop: 16 }}>
				{editable && (
					// biome-ignore lint/a11y/noStaticElementInteractions: drop target around a keyboard-usable file input
					<div
						onDragOver={(e) => e.preventDefault()}
						onDrop={(e) => {
							e.preventDefault();
							if (e.dataTransfer.files.length) upload(e.dataTransfer.files);
						}}
					>
						{picker(
							<>
								<span
									className="icon-[solar--cloud-upload-linear] size-[18px]"
									aria-hidden="true"
								/>
								<span>
									Drop files here or <span className="link">browse</span> — up
									to 25 MB each
								</span>
							</>,
							"dropzone",
							{ marginBottom: 16 },
						)}
					</div>
				)}
				{uploads.length > 0 && (
					<div className="col" style={{ gap: 6, marginBottom: 16 }}>
						{uploads.map((x) => {
							const k = FILE_TYPES[fileKind(x.name)];
							return (
								<div key={x.id} className="upl">
									<span
										className="ftype"
										style={{ "--c": k.c } as React.CSSProperties}
									>
										<span
											className={cn(k.icon, "size-3.5")}
											aria-hidden="true"
										/>
									</span>
									<div className="grow">
										<div className="row">
											<span className="trunc" style={{ fontWeight: 500 }}>
												{x.name}
											</span>
											<span className="sp" />
											<span className="faint num" style={{ fontSize: 11.5 }}>
												{x.pct}%
											</span>
										</div>
										<div className="prog" style={{ marginTop: 6 }}>
											<i
												style={{ "--p": x.pct / 100 } as React.CSSProperties}
											/>
										</div>
									</div>
								</div>
							);
						})}
					</div>
				)}
				{!files.length ? (
					<div className="empty-state">
						<div className="glyph">
							<span
								className={cn(
									filtered
										? "icon-[solar--magnifer-bug-linear]"
										: "icon-[solar--folder-open-linear]",
									"size-5",
								)}
								aria-hidden="true"
							/>
						</div>
						<h2 className="es-h">
							{filtered ? "No results found" : "No files yet"}
						</h2>
						<p>
							{filtered
								? "No files match your search."
								: "Upload designs, documents, and assets to share them with the project."}
						</p>
					</div>
				) : layout === "grid" ? (
					<div className="fgrid">
						{files.map((f) => (
							<div key={f.id} className="fcard">
								<button
									type="button"
									className="fprev"
									aria-label={`Preview ${f.name}`}
									onClick={() => setPreview(f)}
								>
									<Preview f={f} />
								</button>
								<div className="fi">
									<span className="fn trunc">{f.name}</span>
									<span className="fm" suppressHydrationWarning>
										{fmtSize(f.size)} · {who(f.uploadedBy)} · {ago(f.createdAt)}
									</span>
								</div>
								<FileMenu
									slug={slug}
									f={f}
									editable={editable}
									onOpenTask={openTask}
									className="ibtn ibtn-xs more"
								/>
							</div>
						))}
					</div>
				) : (
					<div className="panel" style={{ overflowX: "auto" }}>
						<table className="perm-t" style={{ minWidth: 680 }}>
							<thead>
								<tr>
									<th style={{ paddingLeft: 14 }}>Name</th>
									<th style={{ textAlign: "left" }}>Type</th>
									<th style={{ textAlign: "left" }}>Size</th>
									<th style={{ textAlign: "left" }}>Uploaded by</th>
									<th style={{ textAlign: "left" }}>Date</th>
									<th>
										<span className="sr-only">Actions</span>
									</th>
								</tr>
							</thead>
							<tbody>
								{files.map((f) => {
									const k = FILE_TYPES[fileKind(f.name)];
									return (
										<tr key={f.id}>
											<td style={{ paddingLeft: 14 }}>
												<span className="row">
													<span
														className="ftype"
														style={{ "--c": k.c } as React.CSSProperties}
													>
														<span
															className={cn(k.icon, "size-3.5")}
															aria-hidden="true"
														/>
													</span>
													<a
														href={f.url}
														target="_blank"
														rel="noreferrer noopener"
														style={{ fontWeight: 500 }}
													>
														{f.name}
													</a>
													{f.taskId && f.taskKey && (
														<button
															type="button"
															className="badge"
															onClick={() => openTask(f.taskId as string)}
														>
															<span
																className="icon-[solar--link-linear] size-2.5"
																aria-hidden="true"
															/>
															{f.taskKey}
														</button>
													)}
												</span>
											</td>
											<td style={{ textAlign: "left" }} className="muted">
												{k.name}
											</td>
											<td style={{ textAlign: "left" }} className="num muted">
												{fmtSize(f.size)}
											</td>
											<td style={{ textAlign: "left" }} className="muted">
												{who(f.uploadedBy)}
											</td>
											<td
												style={{ textAlign: "left" }}
												className="muted"
												suppressHydrationWarning
											>
												{ago(f.createdAt)}
											</td>
											<td>
												<FileMenu
													slug={slug}
													f={f}
													editable={editable}
													onOpenTask={openTask}
												/>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				)}
			</div>
			<FilePreviewModal
				f={preview}
				onOpenChange={(o) => !o && setPreview(null)}
				uploader={preview ? who(preview.uploadedBy) : undefined}
				attachedTo={preview?.taskKey ?? undefined}
				onOpenTask={
					preview?.taskId
						? () => {
								openTask(preview.taskId as string);
								setPreview(null);
							}
						: undefined
				}
			/>
		</>
	);
}

/** Images show themselves; everything else shows its kind (reference filePrev). */
export function Preview({
	f,
	fit = "cover",
}: {
	f: TaskAttachment;
	/** "contain" shows a whole image, for the preview window */
	fit?: "cover" | "contain";
}) {
	const kind = fileKind(f.name);
	const k = FILE_TYPES[kind];
	return (
		<>
			{kind === "img" ? (
				<img
					src={f.url}
					alt=""
					loading="lazy"
					style={{ width: "100%", height: "100%", objectFit: fit }}
				/>
			) : (
				<span
					style={{
						color: k.c,
						display: "grid",
						placeItems: "center",
						height: "100%",
					}}
				>
					<span className={cn(k.icon, "size-8")} aria-hidden="true" />
				</span>
			)}
			<span className="ext" style={{ "--c": k.c } as React.CSSProperties}>
				{(f.name.split(".").pop() ?? "").slice(0, 4)}
			</span>
		</>
	);
}

/** One file, larger (reference filePreviewModal): who added it, where it's attached, its link. */
export function FilePreviewModal({
	f,
	onOpenChange,
	uploader,
	attachedTo,
	onOpenTask,
}: {
	f: TaskAttachment | null;
	onOpenChange: (open: boolean) => void;
	uploader?: string;
	/** the task's name or key, when the file belongs to a task */
	attachedTo?: string;
	onOpenTask?: () => void;
}) {
	const k = f ? FILE_TYPES[fileKind(f.name)] : null;
	return (
		<Modal
			open={!!f}
			onOpenChange={onOpenChange}
			title={f?.name ?? ""}
			sub={
				f && (
					<span suppressHydrationWarning>
						{k?.name} · {fmtSize(f.size)} · Uploaded by {uploader ?? "someone"}{" "}
						{ago(f.createdAt)}
					</span>
				)
			}
			size="lg"
			footer={
				<>
					<button
						type="button"
						className="btn btn-secondary"
						onClick={() => {
							if (!f) return;
							toast
								.promise(navigator.clipboard.writeText(f.url), {
									loading: "Copying link…",
									success: "Link copied",
									error: "Couldn't copy the link",
								})
								.catch(() => {});
						}}
					>
						<span
							className="icon-[solar--link-linear] size-3.5"
							aria-hidden="true"
						/>
						Copy link
					</button>
					<span className="sp" />
					<button
						type="button"
						className="btn btn-primary"
						onClick={() => onOpenChange(false)}
					>
						Close
					</button>
				</>
			}
		>
			{f && (
				<div className="modal-b">
					<a
						href={f.url}
						target="_blank"
						rel="noreferrer noopener"
						aria-label={`Open ${f.name} in a new tab`}
						style={{
							display: "block",
							border: "1px solid var(--q-border)",
							borderRadius: "var(--q-r-lg)",
							overflow: "hidden",
						}}
					>
						<span
							className="fprev"
							style={{ aspectRatio: "16/9", display: "block" }}
						>
							<Preview f={f} fit="contain" />
						</span>
					</a>
					{attachedTo && (
						<div className="row faint" style={{ fontSize: 12.5 }}>
							<span
								className="icon-[solar--link-linear] size-[13px]"
								aria-hidden="true"
							/>
							Attached to
							{onOpenTask ? (
								<button type="button" className="link" onClick={onOpenTask}>
									{attachedTo}
								</button>
							) : (
								<span>{attachedTo}</span>
							)}
						</div>
					)}
				</div>
			)}
		</Modal>
	);
}

function FileMenu({
	slug,
	f,
	editable,
	onOpenTask,
	className = "ibtn ibtn-sm",
}: {
	slug: string;
	f: TaskAttachment;
	editable: boolean;
	onOpenTask: (id: string) => void;
	className?: string;
}) {
	const [renaming, setRenaming] = useState(false);
	const [name, setName] = useState(f.name);
	const [deleting, setDeleting] = useState(false);
	const [rename, { loading }] = useMutation(RENAME_ATTACHMENT, REFETCH);
	const [remove] = useMutation(REMOVE_ATTACHMENT, REFETCH);
	return (
		<>
			<Menu>
				<MenuTrigger className={className} aria-label={`Options for ${f.name}`}>
					<span
						className="icon-[solar--menu-dots-bold] size-[13px]"
						aria-hidden="true"
					/>
				</MenuTrigger>
				<MenuContent width={200}>
					<MenuItem
						icon="icon-[solar--eye-linear]"
						onSelect={() => window.open(f.url, "_blank", "noopener")}
					>
						Open
					</MenuItem>
					{f.taskId && (
						<MenuItem
							icon="icon-[solar--checklist-minimalistic-linear]"
							onSelect={() => onOpenTask(f.taskId as string)}
						>
							Open task {f.taskKey}
						</MenuItem>
					)}
					<MenuItem
						icon="icon-[solar--link-linear]"
						onSelect={() => {
							toast
								.promise(navigator.clipboard.writeText(f.url), {
									loading: "Copying link…",
									success: "Link copied",
									error: "Couldn't copy the link",
								})
								.catch(() => {});
						}}
					>
						Copy link
					</MenuItem>
					{editable && (
						<>
							<MenuItem
								icon="icon-[solar--pen-linear]"
								onSelect={() => {
									setName(f.name);
									setRenaming(true);
								}}
							>
								Rename
							</MenuItem>
							<MenuSeparator />
							<MenuItem
								icon="icon-[solar--trash-bin-minimalistic-linear]"
								danger
								onSelect={() => setDeleting(true)}
							>
								Delete
							</MenuItem>
						</>
					)}
				</MenuContent>
			</Menu>
			<Modal
				busy={loading}
				open={renaming}
				onOpenChange={setRenaming}
				title="Rename file"
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
							form={`rename-${f.id}`}
							className={cn("btn btn-primary", loading && "is-loading")}
							disabled={!name.trim()}
						>
							Save
						</button>
					</>
				}
			>
				<form
					id={`rename-${f.id}`}
					className="modal-b"
					onSubmit={async (e) => {
						e.preventDefault();
						try {
							await toast.promise(
								rename({
									variables: { slug, id: f.id, name: name.trim() },
								}),
								{
									loading: "Renaming file…",
									success: `Renamed to ${name.trim()}`,
									error: "Couldn't rename the file",
								},
							);
							setRenaming(false);
						} catch {
							// the toast already shows why
						}
					}}
				>
					<div className="field">
						<label className="label" htmlFor={`rename-in-${f.id}`}>
							File name
						</label>
						<input
							className="input"
							id={`rename-in-${f.id}`}
							value={name}
							onChange={(e) => setName(e.target.value)}
							maxLength={255}
						/>
					</div>
				</form>
			</Modal>
			<ConfirmModal
				open={deleting}
				onOpenChange={setDeleting}
				title={`Delete ${f.name}?`}
				body="The file is removed from the project and its task."
				ok="Delete file"
				danger
				onConfirm={async () => {
					await toast.promise(remove({ variables: { slug, id: f.id } }), {
						loading: `Deleting ${f.name}…`,
						success: `Deleted ${f.name}`,
						error: "Couldn't delete the file",
					});
				}}
			/>
		</>
	);
}
