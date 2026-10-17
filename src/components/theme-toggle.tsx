import { isDark, setAppearance } from "#/lib/appearance";
import { cn } from "#/lib/utils";

/** Light/dark switch for pages outside the app shell (homepage, sign-in, onboarding). */
export function ThemeToggle({ className }: { className?: string }) {
	return (
		<button
			type="button"
			className={cn("ibtn", className)}
			data-tip="Toggle theme"
			aria-label="Toggle theme"
			onClick={() => setAppearance({ theme: isDark() ? "light" : "dark" })}
		>
			{/* both icons render; CSS picks one, so the server needn't know the theme */}
			<span
				className="icon-[solar--moon-linear] size-4 dark:hidden"
				aria-hidden="true"
			/>
			<span
				className="icon-[solar--sun-2-linear] hidden size-4 dark:inline-block"
				aria-hidden="true"
			/>
		</button>
	);
}
