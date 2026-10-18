import type { ReactNode } from "react";
import { Menu, MenuContent, MenuTrigger } from "./menu";

const EMOJI =
	"📄 📝 📌 📎 📚 📘 📗 📕 🗂️ 🗒️ 💡 🎯 🚀 ✅ ⭐ 🔥 🧭 🧪 🛠️ 🎨 📣 📈 💬 🗓️ 🔒 🌱 🏁 🧩 ❤️ 👋".split(
		" ",
	);

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
	return (
		<Menu>
			<MenuTrigger asChild disabled={disabled}>
				{children}
			</MenuTrigger>
			<MenuContent width={236} align="start">
				<div className="emoji-grid">
					{EMOJI.map((e) => (
						<button key={e} type="button" onClick={() => onPick(e)}>
							{e}
						</button>
					))}
				</div>
				{icon && (
					<button
						type="button"
						className="mi"
						style={{ width: "100%" }}
						onClick={() => onPick(null)}
					>
						Remove icon
					</button>
				)}
			</MenuContent>
		</Menu>
	);
}
