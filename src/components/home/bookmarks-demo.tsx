import { AnimatePresence, useReducedMotion } from "motion/react";
import { useRef, useState } from "react";
import { ToastCard } from "#/components/toast/toast-card";
import type { ToastData } from "#/lib/toast";
import { cn } from "#/lib/utils";
import { Stage, useDemoLoop } from "./demo-stage";

// A bookmark collection, drawn with the Bookmarks page's own classes (.ph, .fgrid, .fcard.bcard,
// .bthumb, .btitle, .bdesc, .bmeta): a link is added, its card joins the grid and the app's
// "Bookmark added" toast confirms it.

type Mark = {
	id: string;
	title: string;
	desc: string;
	site: string;
	ago: string;
	icon: string;
	tags?: string[];
	fav?: boolean;
};

const ICON = {
	article: "icon-[solar--notebook-linear]",
	document: "icon-[solar--document-text-linear]",
	video: "icon-[solar--play-circle-linear]",
};
const START: Mark[] = [
	{
		id: "1",
		title: "Designing for offline first",
		desc: "How to keep an app useful with no signal.",
		site: "web.dev",
		ago: "2d ago",
		icon: ICON.article,
		tags: ["mobile"],
		fav: true,
	},
	{
		id: "2",
		title: "App Store screenshot sizes",
		desc: "Every size Apple asks for, in one table.",
		site: "developer.apple.com",
		ago: "4d ago",
		icon: ICON.document,
	},
	{
		id: "3",
		title: "Conflict-free sync, explained",
		desc: "A short talk on merging edits from two devices.",
		site: "youtube.com",
		ago: "1w ago",
		icon: ICON.video,
		tags: ["sync"],
	},
];
const NEW: Mark = {
	id: "4",
	title: "Haptics guidelines",
	desc: "When a tap should be felt, and how strongly.",
	site: "developer.apple.com",
	ago: "just now",
	icon: ICON.article,
	tags: ["design"],
};
const ADDED: ToastData = {
	id: 3,
	type: "success",
	title: "Bookmark added",
	duration: 2600,
};

function Card({ b }: { b: Mark }) {
	return (
		<div className="fcard bcard">
			<span className="bthumb fprev">
				<span className={cn(b.icon, "size-6 faint")} />
			</span>
			<div className="fi">
				{b.tags && (
					<span className="btags trunc">
						{b.tags.map((t) => (
							<span key={t}>#{t}</span>
						))}
					</span>
				)}
				<span className="btitle">{b.title}</span>
				<span className="bdesc">{b.desc}</span>
				<span className="bmeta">
					{b.fav && (
						<span
							className="icon-[solar--star-bold] size-3"
							style={{ color: "var(--q-amber)" }}
						/>
					)}
					<span className="trunc">{b.site}</span>
					<span>·</span>
					<span>{b.ago}</span>
				</span>
			</div>
		</div>
	);
}

export function BookmarksDemo() {
	const stage = useRef<HTMLDivElement>(null);
	const [added, setAdded] = useState(false);
	const [toast, setToast] = useState(false);
	const reduce = useReducedMotion() ?? false;

	useDemoLoop(
		stage,
		async (wait) => {
			await wait(1800);
			setAdded(true);
			setToast(true);
			await wait(5200);
		},
		() => {
			setAdded(false);
			setToast(false);
		},
		() => setAdded(true),
	);

	const marks = added ? [NEW, ...START] : START;
	return (
		<Stage
			width={820}
			height={430}
			label="A Zadaci bookmark collection: a new link is added and its card joins the grid"
			stageRef={stage}
			fluid
		>
			<div
				className="page wide"
				style={{ padding: "22px 20px 0", maxWidth: "none" }}
			>
				<div className="ph">
					<div style={{ minWidth: 0 }}>
						<h1 className="row" style={{ gap: 8 }}>
							<span className="icon-[solar--folder-linear] size-5" />
							<span className="trunc">Mobile research</span>
						</h1>
						<p>{marks.length} bookmarks</p>
					</div>
					<div className="acts">
						<span className="btn btn-primary">
							<span className="icon-[hugeicons--plus-sign] size-3.5" />
							Add bookmark
						</span>
					</div>
				</div>
				<div className="fgrid">
					{marks.map((b) => (
						<Card key={b.id} b={b} />
					))}
				</div>
			</div>
			<div
				className="tst-root absolute right-4 bottom-4"
				style={{ width: 280, height: 64, zIndex: 2 }}
			>
				<AnimatePresence>
					{toast && (
						<ToastCard
							t={ADDED}
							layout={{ ty: 0, s: 1, o: 1, contentShown: true, z: 1 }}
							paused={false}
							reduce={reduce}
							isBottom
							onHeight={() => {}}
							onClose={() => setToast(false)}
						/>
					)}
				</AnimatePresence>
			</div>
		</Stage>
	);
}
