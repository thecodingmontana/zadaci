import { lazy, Suspense } from "react";

// The emoji picker (emoji-picker-impl) loads the first time one opens, so pages don't carry it.
const Picker = lazy(() => import("./emoji-picker-impl"));

export function EmojiPicker(props: {
	onPick: (emoji: string) => void;
	autoFocus?: boolean;
}) {
	return (
		<Suspense
			fallback={
				<div className="emoji-picker">
					<span className="emoji-note faint">Loading…</span>
				</div>
			}
		>
			<Picker {...props} />
		</Suspense>
	);
}
