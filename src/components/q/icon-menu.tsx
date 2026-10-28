import { type ReactNode, useState } from "react";
import { PickPopover } from "#/components/tasks/pick";
import { EmojiPicker } from "./emoji-picker";

/** The emoji picker for an icon (a note page, a bookmark collection), opened from its trigger. */
export function IconMenu({
	icon,
	onPick,
	disabled,
	children,
}: {
	icon: string | null;
	onPick: (icon: string | null) => void;
	disabled?: boolean;
	children: ReactNode;
}) {
	const [open, setOpen] = useState(false);
	const pick = (value: string | null) => {
		onPick(value);
		setOpen(false);
	};
	if (disabled) return children;
	return (
		<PickPopover
			trigger={children}
			open={open}
			onOpenChange={setOpen}
			width={300}
		>
			<EmojiPicker onPick={pick} />
			{icon && (
				<button
					type="button"
					className="mi"
					style={{ width: "100%" }}
					onClick={() => pick(null)}
				>
					Remove icon
				</button>
			)}
		</PickPopover>
	);
}
