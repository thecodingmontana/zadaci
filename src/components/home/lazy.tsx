import {
	type ComponentType,
	lazy,
	Suspense,
	startTransition,
	useEffect,
	useRef,
	useState,
} from "react";

// Demos below the first screen load (code and all) only as they come near the viewport. Until
// then a frame of the same size holds their place, so nothing shifts when they arrive.

function near(ref: React.RefObject<HTMLElement | null>, onNear: () => void) {
	const el = ref.current;
	if (!el) return;
	const io = new IntersectionObserver(
		([e]) => {
			if (e?.isIntersecting) {
				io.disconnect();
				onNear();
			}
		},
		{ rootMargin: "800px 0px" },
	);
	io.observe(el);
	return () => io.disconnect();
}

/** Mounts `Demo` (a lazy component) once it comes near the screen; a same-size frame until then. */
export function LazyMount({
	Demo,
	height,
	frame = true,
}: {
	Demo: ComponentType;
	height: number;
	frame?: boolean;
}) {
	const ref = useRef<HTMLDivElement>(null);
	const [show, setShow] = useState(false);
	// a transition, so mounting a demo yields to scrolling instead of blocking a frame
	useEffect(() => near(ref, () => startTransition(() => setShow(true))), []);
	return show ? (
		<Suspense fallback={<Hold height={height} frame={frame} />}>
			<Demo />
		</Suspense>
	) : (
		<div ref={ref}>
			<Hold height={height} frame={frame} />
		</div>
	);
}

const Hold = ({ height, frame }: { height: number; frame: boolean }) => (
	<div
		aria-hidden="true"
		className={
			frame
				? "rounded-(--q-r-lg) border border-(color:--q-border) bg-(--q-bg)"
				: undefined
		}
		style={{ height }}
	/>
);

const ChatDemoLazy = lazy(() =>
	import("./chat-demo").then((m) => ({ default: m.ChatDemo })),
);
export const ChatDemo = () => <LazyMount Demo={ChatDemoLazy} height={520} />;
const NoteDemoLazy = lazy(() =>
	import("./note-demo").then((m) => ({ default: m.NoteDemo })),
);
export const NoteDemo = () => <LazyMount Demo={NoteDemoLazy} height={560} />;
const ZadDemoLazy = lazy(() =>
	import("./zad-demo").then((m) => ({ default: m.ZadDemo })),
);
export const ZadDemo = () => <LazyMount Demo={ZadDemoLazy} height={600} />;
const GithubDemoLazy = lazy(() =>
	import("./github-demo").then((m) => ({ default: m.GithubDemo })),
);
export const GithubDemo = () => (
	<LazyMount Demo={GithubDemoLazy} height={620} />
);
const BookmarksDemoLazy = lazy(() =>
	import("./bookmarks-demo").then((m) => ({ default: m.BookmarksDemo })),
);
export const BookmarksDemo = () => (
	<LazyMount Demo={BookmarksDemoLazy} height={430} />
);
const InboxDemoLazy = lazy(() =>
	import("./inbox-demo").then((m) => ({ default: m.InboxDemo })),
);
export const InboxDemo = () => <LazyMount Demo={InboxDemoLazy} height={470} />;
