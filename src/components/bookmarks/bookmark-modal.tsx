import { useApolloClient, useMutation } from "@apollo/client/react";
import { type FormEvent, useId, useRef, useState } from "react";
import { Modal } from "#/components/q/modal";
import {
	type BookmarkCollectionItem,
	type BookmarkItem,
	type BookmarkKind,
	CREATE_BOOKMARK,
	LINK_PREVIEW,
	MOVE_BOOKMARK,
	UPDATE_BOOKMARK,
} from "#/graphql/bookmark-operations";
import { toast } from "#/lib/toast";
import { cn } from "#/lib/utils";
import { KINDS, REFETCH } from "./bookmark-card";

// Add or edit a bookmark: paste a link and the page's title, description and image fill in
// (all editable), then file it in collections and tag it.

type Form = {
	url: string;
	title: string;
	description: string;
	image: string | null;
	kind: BookmarkKind | null;
	tags: string[];
	collectionIds: string[];
};

const blank = (collectionId?: string): Form => ({
	url: "",
	title: "",
	description: "",
	image: null,
	kind: null,
	tags: [],
	collectionIds: collectionId ? [collectionId] : [],
});

const fromBookmark = (b: BookmarkItem): Form => ({
	url: b.url,
	title: b.title,
	description: b.description ?? "",
	image: b.image,
	kind: b.kind,
	tags: b.tags,
	collectionIds: b.collectionIds,
});

export function BookmarkModal({
	slug,
	open,
	onOpenChange,
	bookmark,
	collections,
	collectionId,
	allTags,
}: {
	slug: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** given: edit it; otherwise add a new one */
	bookmark?: BookmarkItem;
	collections: BookmarkCollectionItem[];
	/** the collection a new bookmark starts in */
	collectionId?: string;
	allTags: string[];
}) {
	const client = useApolloClient();
	const [form, setForm] = useState<Form>(() =>
		bookmark ? fromBookmark(bookmark) : blank(collectionId),
	);
	const [busy, setBusy] = useState(false);
	const [loading, setLoading] = useState(false);
	const [err, setErr] = useState("");
	const previewed = useRef(bookmark?.url ?? "");
	const [create] = useMutation(CREATE_BOOKMARK, { refetchQueries: REFETCH });
	const [update] = useMutation(UPDATE_BOOKMARK);
	const [move] = useMutation(MOVE_BOOKMARK);
	const set = <K extends keyof Form>(key: K, value: Form[K]) =>
		setForm((f) => ({ ...f, [key]: value }));
	const id = useId();
	const targets = collections.filter(
		(c) => c.canEdit || form.collectionIds.includes(c.id),
	);

	const preview = async (url: string) => {
		const link = url.trim();
		if (!link || link === previewed.current) return;
		previewed.current = link;
		setLoading(true);
		setErr("");
		try {
			const { data } = await client.query({
				query: LINK_PREVIEW,
				variables: { slug, url: link },
				fetchPolicy: "no-cache",
			});
			const page = data?.linkPreview;
			if (!page) return;
			// the page's details replace what came from the last link, never what was typed
			setForm((f) => ({
				...f,
				url: page.url,
				title: page.title,
				description: page.description ?? "",
				image: page.image,
				kind: page.kind,
			}));
		} catch (error) {
			setErr((error as Error).message);
		} finally {
			setLoading(false);
		}
	};

	const submit = async (e: FormEvent) => {
		e.preventDefault();
		if (!form.url.trim()) return setErr("Paste a link first");
		setBusy(true);
		const fields = {
			url: form.url.trim(),
			title: form.title.trim() || undefined,
			description: form.description.trim() || null,
			image: form.image,
			kind: form.kind ?? undefined,
			tags: form.tags,
		};
		try {
			if (bookmark) {
				await update({ variables: { slug, id: bookmark.id, patch: fields } });
				if (form.collectionIds.join() !== bookmark.collectionIds.join())
					await move({
						variables: {
							slug,
							id: bookmark.id,
							collectionIds: form.collectionIds,
						},
					});
				await client.refetchQueries({ include: REFETCH });
				toast.success("Bookmark saved");
			} else {
				await create({
					variables: {
						slug,
						input: { ...fields, collectionIds: form.collectionIds },
					},
				});
				toast.success("Bookmark added");
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
			title={bookmark ? "Edit bookmark" : "Add bookmark"}
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
						disabled={busy || loading}
					>
						{bookmark ? "Save changes" : "Save bookmark"}
					</button>
				</>
			}
		>
			<form id={`${id}-form`} className="modal-b" onSubmit={submit}>
				<div className="field">
					<label className="label" htmlFor={`${id}-url`}>
						Link
					</label>
					<div className="inwrap">
						<span
							className={cn(
								"i size-[13px]",
								loading
									? "icon-[hugeicons--loading-03] animate-spin"
									: "icon-[solar--link-linear]",
							)}
							aria-hidden="true"
						/>
						<input
							id={`${id}-url`}
							className={cn("input", err && "is-error")}
							type="url"
							inputMode="url"
							placeholder="https://…"
							value={form.url}
							onChange={(e) => {
								set("url", e.target.value);
								if (err) setErr("");
							}}
							onPaste={(e) => {
								const text = e.clipboardData.getData("text");
								if (text) void preview(text);
							}}
							onBlur={(e) => void preview(e.target.value)}
							aria-invalid={!!err}
							aria-describedby={err ? `${id}-err` : undefined}
							// biome-ignore lint/a11y/noAutofocus: the dialog opens to paste a link
							autoFocus={!bookmark}
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

				<div className="bpreview">
					<span className="bthumb">
						{form.image ? (
							<img src={form.image} alt="" referrerPolicy="no-referrer" />
						) : (
							<span
								className={cn(
									KINDS[form.kind ?? "article"].icon,
									"size-6 faint",
								)}
								aria-hidden="true"
							/>
						)}
						{form.image && (
							<button
								type="button"
								className="ibtn ibtn-xs"
								aria-label="Remove image"
								onClick={() => set("image", null)}
							>
								<span
									className="icon-[solar--close-linear] size-3"
									aria-hidden="true"
								/>
							</button>
						)}
					</span>
					<div
						className="grow"
						style={{ minWidth: 0, display: "grid", gap: 6 }}
					>
						<input
							className="input"
							aria-label="Title"
							placeholder={loading ? "Reading the page…" : "Title"}
							value={form.title}
							maxLength={300}
							onChange={(e) => set("title", e.target.value)}
						/>
						<textarea
							className="textarea"
							aria-label="Description"
							placeholder="Description"
							rows={2}
							maxLength={1000}
							value={form.description}
							onChange={(e) => set("description", e.target.value)}
						/>
					</div>
				</div>

				<fieldset className="field">
					<legend className="label">Type</legend>
					<div className="seg">
						{(Object.keys(KINDS) as BookmarkKind[]).map((k) => (
							<button
								key={k}
								type="button"
								aria-pressed={(form.kind ?? "article") === k}
								className={(form.kind ?? "article") === k ? "on" : ""}
								onClick={() => set("kind", k)}
							>
								<span
									className={cn(KINDS[k].icon, "size-[13px]")}
									aria-hidden="true"
								/>
								{KINDS[k].label}
							</button>
						))}
					</div>
				</fieldset>

				{targets.length > 0 && (
					<fieldset className="field">
						<legend className="label">Collections</legend>
						<div className="bpick">
							{targets.map((c) => (
								<label key={c.id} className="row">
									<input
										type="checkbox"
										className="check"
										disabled={!c.canEdit}
										checked={form.collectionIds.includes(c.id)}
										onChange={(e) =>
											set(
												"collectionIds",
												e.target.checked
													? [...form.collectionIds, c.id]
													: form.collectionIds.filter((x) => x !== c.id),
											)
										}
									/>
									{c.icon ? (
										<span aria-hidden="true">{c.icon}</span>
									) : (
										<span
											className="icon-[solar--folder-linear] size-3.5 faint"
											aria-hidden="true"
										/>
									)}
									<span className="trunc">{c.name}</span>
									{c.isPrivate && (
										<span
											className="icon-[solar--lock-keyhole-linear] size-3 faint"
											role="img"
											aria-label="Private"
										/>
									)}
								</label>
							))}
						</div>
					</fieldset>
				)}

				<TagInput
					tags={form.tags}
					suggestions={allTags}
					onChange={(tags) => set("tags", tags)}
				/>
			</form>
		</Modal>
	);
}

function TagInput({
	tags,
	suggestions,
	onChange,
}: {
	tags: string[];
	suggestions: string[];
	onChange: (tags: string[]) => void;
}) {
	const id = useId();
	const [text, setText] = useState("");
	const add = (raw: string) => {
		const tag = raw.trim().replace(/^#+/, "").trim().slice(0, 40);
		setText("");
		if (!tag || tags.some((t) => t.toLowerCase() === tag.toLowerCase())) return;
		onChange([...tags, tag]);
	};
	return (
		<div className="field">
			<label className="label" htmlFor={id}>
				Tags
			</label>
			<div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
				{tags.map((t) => (
					<span key={t} className="chip">
						#{t}
						<button
							type="button"
							className="ibtn"
							aria-label={`Remove tag ${t}`}
							onClick={() => onChange(tags.filter((x) => x !== t))}
						>
							<span
								className="icon-[solar--close-linear] size-3"
								aria-hidden="true"
							/>
						</button>
					</span>
				))}
				<input
					id={id}
					className="input"
					style={{ flex: 1, minWidth: 140 }}
					list={`${id}-list`}
					placeholder={tags.length >= 20 ? "20 tags at most" : "Add a tag"}
					disabled={tags.length >= 20}
					value={text}
					onChange={(e) => setText(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter" || e.key === ",") {
							e.preventDefault();
							add(text);
						} else if (e.key === "Backspace" && !text && tags.length)
							onChange(tags.slice(0, -1));
					}}
					onBlur={() => text && add(text)}
				/>
				<datalist id={`${id}-list`}>
					{suggestions
						.filter((s) => !tags.includes(s))
						.map((s) => (
							<option key={s} value={s} />
						))}
				</datalist>
			</div>
		</div>
	);
}
