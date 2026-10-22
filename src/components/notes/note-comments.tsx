import { useMutation } from "@apollo/client/react";
import { useState } from "react";
import { Av } from "#/components/q/av";
import { useModKey } from "#/components/shell/command-menu";
import {
	ADD_NOTE_COMMENT,
	type NoteComment,
	type NoteDetail,
	RESOLVE_NOTE_COMMENT,
} from "#/graphql/note-operations";
import { DELETE_COMMENT } from "#/graphql/operations";
import { ago } from "#/lib/time";
import { toast } from "#/lib/toast";
import { cn } from "#/lib/utils";

// Comments under a page: open ones first, resolved ones folded away. Same look as task comments.

const REFETCH = { refetchQueries: ["Note"] };

export function NoteComments({
	slug,
	note,
}: {
	slug: string;
	note: NoteDetail;
}) {
	const [showResolved, setShowResolved] = useState(false);
	const open = note.comments.filter((c) => !c.resolved);
	const resolved = note.comments.filter((c) => c.resolved);
	if (!note.canComment && !note.comments.length) return null;
	return (
		<section className="dsec note-comments" aria-label="Comments">
			<div className="tabs" style={{ marginBottom: 6 }}>
				<span className="tab on">
					Comments<span className="cnt">{open.length}</span>
				</span>
				{resolved.length > 0 && (
					<button
						type="button"
						className="tab"
						onClick={() => setShowResolved((v) => !v)}
						aria-expanded={showResolved}
					>
						{showResolved ? "Hide resolved" : "Show resolved"}
						<span className="cnt">{resolved.length}</span>
					</button>
				)}
			</div>
			{open.length === 0 && !showResolved && (
				<p className="faint" style={{ fontSize: 13, margin: "10px 0" }}>
					No open comments.
				</p>
			)}
			{open.map((c) => (
				<CommentRow key={c.id} slug={slug} c={c} full={note.canDelete} />
			))}
			{showResolved &&
				resolved.map((c) => (
					<CommentRow key={c.id} slug={slug} c={c} full={note.canDelete} />
				))}
			{note.canComment && <Composer slug={slug} noteId={note.id} />}
		</section>
	);
}

function CommentRow({
	slug,
	c,
	full,
}: {
	slug: string;
	c: NoteComment;
	full: boolean;
}) {
	const [resolve] = useMutation(RESOLVE_NOTE_COMMENT, REFETCH);
	const [remove] = useMutation(DELETE_COMMENT, REFETCH);
	const mayChange = c.isMine || full;
	return (
		<div className={cn("cmt", c.resolved && "is-resolved")}>
			<Av name={c.author?.name ?? "?"} image={c.author?.image} className="md" />
			<div className="body">
				<div className="who">
					<b>{c.author?.name ?? "Someone"}</b>
					<time dateTime={c.createdAt} suppressHydrationWarning>
						{ago(c.createdAt)}
					</time>
					{c.resolved && <span className="faint">· Resolved</span>}
					{mayChange && (
						<>
							<span className="sp" />
							<button
								type="button"
								className="ibtn ibtn-xs"
								aria-label={c.resolved ? "Reopen comment" : "Resolve comment"}
								data-tip={c.resolved ? "Reopen" : "Resolve"}
								onClick={() =>
									resolve({
										variables: { slug, id: c.id, resolved: !c.resolved },
									}).catch((error: Error) =>
										toast.error("Couldn't update the comment", {
											desc: error.message,
										}),
									)
								}
							>
								<span
									className={cn(
										c.resolved
											? "icon-[solar--restart-linear]"
											: "icon-[solar--check-circle-linear]",
										"size-3.5",
									)}
									aria-hidden="true"
								/>
							</button>
							<button
								type="button"
								className="ibtn ibtn-xs"
								aria-label="Delete comment"
								data-tip="Delete"
								onClick={() =>
									toast
										.promise(remove({ variables: { slug, id: c.id } }), {
											loading: "Deleting comment…",
											success: "Comment deleted",
											error: "Couldn't delete the comment",
										})
										.catch(() => {})
								}
							>
								<span
									className="icon-[solar--trash-bin-minimalistic-linear] size-3"
									aria-hidden="true"
								/>
							</button>
						</>
					)}
				</div>
				{c.quote && <blockquote className="cmt-quote">{c.quote}</blockquote>}
				<div className="txt">{c.text}</div>
			</div>
		</div>
	);
}

function Composer({ slug, noteId }: { slug: string; noteId: string }) {
	const mod = useModKey();
	const [text, setText] = useState("");
	const [post, { loading }] = useMutation(ADD_NOTE_COMMENT, REFETCH);
	const submit = async () => {
		const body = text.trim();
		if (!body) return;
		setText("");
		try {
			await post({ variables: { slug, noteId, text: body } });
		} catch (error) {
			// put the text back so nothing typed is lost
			setText(body);
			toast.error("Couldn't post the comment", {
				desc: (error as Error).message,
			});
		}
	};
	return (
		<div className="cbox" style={{ marginTop: 8 }}>
			<textarea
				placeholder="Comment on this page…"
				aria-label="Comment"
				rows={2}
				value={text}
				onChange={(e) => setText(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
						e.preventDefault();
						submit();
					}
				}}
			/>
			<div className="row">
				<span className="sp" />
				<span className="faint hide-m" style={{ fontSize: 11 }}>
					{mod}+Enter
				</span>
				<button
					type="button"
					className={cn("btn btn-primary btn-sm", loading && "is-loading")}
					disabled={!text.trim() || loading}
					onClick={submit}
				>
					Comment
				</button>
			</div>
		</div>
	);
}
