import { useEffect, useState } from "react";
import { isDark, setAppearance, useAppearance } from "#/lib/appearance";
import { toast } from "#/lib/toast";
import { cn } from "#/lib/utils";

/** Light/dark switch for pages outside the app shell (homepage, sign-in, onboarding). */
export function ThemeToggle({ className }: { className?: string }) {
	const appearance = useAppearance();
	// read after mount: the server can't know the theme, so it renders the moon first
	const [dark, setDark] = useState(false);
	// biome-ignore lint/correctness/useExhaustiveDependencies: re-read whenever the theme setting changes
	useEffect(() => setDark(isDark()), [appearance]);

	return (
		<button
			type="button"
			className={cn("ibtn", className)}
			data-tip="Toggle theme"
			aria-label="Toggle theme"
			onClick={() => {
				setAppearance({ theme: isDark() ? "light" : "dark" });
				toast.info(isDark() ? "Dark mode on" : "Light mode on", {
					duration: 1800,
				});
			}}
		>
			<span
				className={cn(
					dark ? "icon-[solar--sun-2-linear]" : "icon-[solar--moon-linear]",
					"size-4",
				)}
				aria-hidden="true"
			/>
		</button>
	);
}
