import { useMutation } from "@apollo/client/react";
import { Fragment, useRef, useState } from "react";
import { Av } from "#/components/q/av";
import { useModKey } from "#/components/shell/command-menu";
import {
	type ActivityItem,
	ADD_COMMENT,
	DELETE_COMMENT,
	REACT_TO_COMMENT,
	type TaskComment,
	type TaskDetail,
} from "#/graphql/operations";
import { hasRight } from "#/lib/permissions";
import { ago } from "#/lib/time";
import { toast } from "#/lib/toast";
import { cn } from "#/lib/utils";
import { TASK_REFETCH, useTaskView } from "./context";
import { PickPopover } from "./pick";

// Comments and activity tabs at the bottom of the task drawer (reference drawer.js).

const EMOJI = ["👍", "❤️", "🎉", "👀", "🚀", "😄", "🙏", "✅"];

export function DrawerConversation({
	t,
	activity,
}: {
	t: TaskDetail;
	activity: ActivityItem[];
}) {
	const [tab, setTab] = useState<"comments" | "activity">("comments");
	return (
		<div className="dsec">
			<div className="tabs" style={{ marginBottom: 6 }} role="tablist">
				{(
					[
						["comments", "Comments", t.comments.length],
						["activity", "Activity", activity.length],
					] as const
				).map(([k, label, n]) => (
					<button
						key={k}
						type="button"
						role="tab"
						aria-selected={tab === k}
						className={cn("tab", tab === k && "on")}
						onClick={() => setTab(k)}
					>
						{label}
						<span className="cnt">{n}</span>
					</button>
				))}
			</div>
			{tab === "comments" ? (
				<Comments t={t} />
			) : (
				<ActivityLines t={t} activity={activity} />
			)}
		</div>
	);
}

/** Comment text with @Name mentions highlighted (reference fmtComment). */
function CommentText({ text }: { text: string }) {
	const { members } = useTaskView();
	const names = members.map((m) => m.name).sort((a, b) => b.length - a.length);
	if (!names.length) return <>{text}</>;
	const escaped = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
	// splitting on a captured group alternates plain text and mentions
	const parts = text.split(new RegExp(`(@(?:${escaped.join("|")}))`));
	let offset = 0;
	return (
		<>
			{parts.map((part, i) => {
				const at = offset;
				offset += part.length;
				return i % 2 ? (
					<span key={at} className="mention">
						{part}
					</span>
				) : (
					<Fragment key={at}>{part}</Fragment>
				);
			})}
		</>
	);
}

export function Comments({ t }: { t: TaskDetail }) {
	const { slug, members, meId, project } = useTaskView();
	const me = members.find((m) => m.id === meId);
	const canComment =
		!!project(t.projectId) &&
		hasRight(project(t.projectId)?.myAccess ?? null, "comment");
	return (
		<>
			{t.comments.length ? (
				t.comments.map((c) => (
					<CommentItem
						key={c.id}
						c={c}
						slug={slug}
						fullAccess={hasRight(
							project(t.projectId)?.myAccess ?? null,
							"full",
						)}
					/>
				))
			) : (
				<p className="faint" style={{ fontSize: 13, margin: "10px 0" }}>
					No comments yet. Start the conversation.
				</p>
			)}
			{canComment && me && <Composer t={t} me={me} />}
		</>
	);
}

function CommentItem({
	c,
	slug,
	fullAccess,
}: {
	c: TaskComment;
	slug: string;
	fullAccess: boolean;
}) {
	const [remove] = useMutation(DELETE_COMMENT, {
		refetchQueries: TASK_REFETCH,
	});
	const [react] = useMutation(REACT_TO_COMMENT, {
		refetchQueries: ["TaskDetail"],
	});
	const fail = (what: string) => (error: Error) =>
		toast.error(what, { desc: error.message });
	const toggle = (emoji: string) =>
		react({ variables: { slug, id: c.id, emoji } }).catch(
			fail("Couldn't react"),
		);
	return (
		<div className="cmt">
			<Av name={c.author?.name ?? "?"} image={c.author?.image} className="md" />
			<div className="body">
				<div className="who">
					<b>{c.author?.name ?? "Someone"}</b>
					<time dateTime={c.createdAt} suppressHydrationWarning>
						{ago(c.createdAt)}
					</time>
					{(c.isMine || fullAccess) && (
						<>
							<span className="sp" />
							<button
								type="button"
								className="ibtn ibtn-xs"
								aria-label="Delete comment"
								data-tip="Delete"
								onClick={() =>
									remove({ variables: { slug, id: c.id } }).catch(
										fail("Couldn't delete the comment"),
									)
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
				<div className="txt">
					<CommentText text={c.text} />
				</div>
				<div className="reacts">
					{c.reactions.map((r) => (
						<button
							key={r.emoji}
							type="button"
							className={cn("react", r.mine && "mine")}
							aria-label={`${r.emoji} ${r.count}`}
							title={r.names.join(", ")}
							onClick={() => toggle(r.emoji)}
						>
							{r.emoji}
							<span className="num">{r.count}</span>
						</button>
					))}
					<PickPopover
						trigger={
							<button
								type="button"
								className="react"
								aria-label="Add reaction"
								style={{ color: "var(--q-text-3)" }}
							>
								<span
									className="icon-[solar--smile-circle-linear] size-[13px]"
									aria-hidden="true"
								/>
							</button>
						}
					>
						<div className="row" style={{ gap: 2, padding: 4 }}>
							{EMOJI.map((e) => (
								<button
									key={e}
									type="button"
									className="ibtn"
									aria-label={`React ${e}`}
									onClick={() => toggle(e)}
								>
									{e}
								</button>
							))}
						</div>
					</PickPopover>
				</div>
			</div>
		</div>
	);
}

function Composer({
	t,
	me,
}: {
	t: TaskDetail;
	me: { name: string; image: string | null };
}) {
	const { slug, members } = useTaskView();
	const mod = useModKey();
	const ref = useRef<HTMLTextAreaElement>(null);
	const [text, setText] = useState("");
	const [mention, setMention] = useState<string | null>(null);
	const [post, { loading }] = useMutation(ADD_COMMENT, {
		refetchQueries: TASK_REFETCH,
	});
	const matches =
		mention === null
			? []
			: members
					.filter((m) =>
						m.name
							.toLowerCase()
							.split(/\s+/)
							.some((w) => w.startsWith(mention.toLowerCase())),
					)
					.slice(0, 5);

	const track = (value: string, caret: number) => {
		const m = /@([\w.-]*)$/.exec(value.slice(0, caret));
		setMention(m ? (m[1] ?? "") : null);
	};
	const pick = (name: string) => {
		const el = ref.current;
		if (!el) return;
		const caret = el.selectionStart;
		const before = text.slice(0, caret).replace(/@[\w.-]*$/, `@${name} `);
		const next = before + text.slice(caret);
		setText(next);
		setMention(null);
		requestAnimationFrame(() => {
			el.focus();
			el.setSelectionRange(before.length, before.length);
		});
	};
	const submit = async () => {
		const body = text.trim();
		if (!body) return;
		try {
			await post({ variables: { slug, taskId: t.id, text: body } });
			setText("");
		} catch (error) {
			toast.error("Couldn't post the comment", {
				desc: (error as Error).message,
			});
		}
	};

	return (
		<div
			className="row"
			style={{ alignItems: "flex-start", gap: 10, marginTop: 8 }}
		>
			<Av name={me.name} image={me.image} className="md" />
			<div className="grow" style={{ position: "relative" }}>
				<div className="cbox">
					<textarea
						ref={ref}
						placeholder="Leave a comment… type @ to mention"
						aria-label="Comment"
						rows={2}
						value={text}
						onChange={(e) => {
							setText(e.target.value);
							track(e.target.value, e.target.selectionStart);
						}}
						onKeyDown={(e) => {
							if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
								e.preventDefault();
								submit();
							}
							if (e.key === "Escape" && mention !== null) {
								e.preventDefault();
								setMention(null);
							}
						}}
					/>
					<div className="row">
						<button
							type="button"
							className="ibtn ibtn-xs"
							data-tip="Mention someone"
							aria-label="Mention"
							onClick={() => {
								const next = `${text}${text && !text.endsWith(" ") ? " " : ""}@`;
								setText(next);
								setMention("");
								requestAnimationFrame(() => ref.current?.focus());
							}}
						>
							<span
								className="icon-[solar--mention-circle-linear] size-3.5"
								aria-hidden="true"
							/>
						</button>
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
				{matches.length > 0 && (
					<div
						className="pop"
						style={{
							position: "absolute",
							top: "auto",
							bottom: "calc(100% + 4px)",
							left: 0,
						}}
					>
						{matches.map((m) => (
							<button
								key={m.id}
								type="button"
								className="mi"
								onClick={() => pick(m.name)}
							>
								<Av name={m.name} image={m.image} className="sm" />
								{m.name}
								{m.title && <span className="r">{m.title}</span>}
							</button>
						))}
					</div>
				)}
			</div>
		</div>
	);
}

function ActivityLines({
	t,
	activity,
}: {
	t: TaskDetail;
	activity: ActivityItem[];
}) {
	const { members } = useTaskView();
	const meUser = members.find((m) => m.isMe)?.userId;
	return (
		<div style={{ paddingTop: 4 }}>
			{activity.map((a) => (
				<div key={a.id} className="act-line">
					<span className="ico">
						<Av
							name={a.actor?.name ?? "?"}
							image={a.actor?.image}
							className="sm"
						/>
					</span>
					<span className="grow">
						<b>
							{a.actor
								? a.actor.id === meUser
									? "You"
									: a.actor.name
								: "Someone"}
						</b>{" "}
						{a.verb.replace(/ of$/, "")}
						{a.extra ? ` ${a.extra}` : ""}
					</span>
					<time
						className="faint"
						style={{ fontSize: 11.5 }}
						suppressHydrationWarning
					>
						{ago(a.createdAt)}
					</time>
				</div>
			))}
			<div className="act-line">
				<span className="ico">
					<span
						className="icon-[hugeicons--plus-sign] size-[13px]"
						aria-hidden="true"
					/>
				</span>
				<span className="grow">Task created</span>
				<time
					className="faint"
					style={{ fontSize: 11.5 }}
					suppressHydrationWarning
				>
					{ago(t.createdAt)}
				</time>
			</div>
		</div>
	);
}
