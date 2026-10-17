import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "#/components/ui/tooltip";
import { isDark, setAppearance } from "#/lib/appearance";
import { cn } from "#/lib/utils";

/** Light/dark switch for pages outside the app shell (homepage, sign-in, onboarding). */
export function ThemeToggle({ className }: { className?: string }) {
	return (
		<TooltipProvider delayDuration={200}>
			<Tooltip>
				<TooltipTrigger asChild>
					<button
						type="button"
						aria-label="Toggle theme"
						onClick={() =>
							setAppearance({ theme: isDark() ? "light" : "dark" })
						}
						className={cn(
							"grid size-9 place-items-center rounded-md text-foreground/80 transition-colors hover:bg-muted hover:text-foreground",
							className,
						)}
					>
						{/* both icons render; CSS picks one, so the server needn't know the theme */}
						<span
							className="icon-[solar--moon-linear] size-[18px] dark:hidden"
							aria-hidden="true"
						/>
						<span
							className="icon-[solar--sun-2-linear] hidden size-[18px] dark:block"
							aria-hidden="true"
						/>
					</button>
				</TooltipTrigger>
				<TooltipContent>Toggle theme</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}
