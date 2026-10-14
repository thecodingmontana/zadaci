import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type * as React from "react";
import { cn } from "#/lib/utils";

// House style: the zadaci "Get Started" look. Press scales to 0.96 (not when disabled, motion-safe).
const buttonVariants = cva(
	"group/button inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md border border-transparent text-sm font-medium whitespace-nowrap transition-[scale,box-shadow,background-color,color,border-color] duration-150 ease-out outline-none focus-visible:ring-4 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 motion-safe:not-disabled:active:scale-[0.96] aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
	{
		variants: {
			variant: {
				default:
					"bg-brand text-white shadow-[0_-1px_0_1px_rgba(249,129,99,1)_inset,0_0_0_1px_#F97452_inset,0_0.5px_0_1.5px_#F97452_inset] hover:shadow-[0_-1px_0_1px_rgba(252,199,185,0.8)_inset,0_0_0_1px_#F97452_inset,0_0.5px_0_1.5px_hsla(0,0%,100%,0.25)_inset] focus-visible:ring-brand/40",
				destructive:
					"bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40",
				outline:
					"border-border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
				secondary:
					"bg-secondary text-secondary-foreground hover:bg-secondary/80",
				ghost:
					"hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
				link: "text-primary underline-offset-4 hover:underline motion-safe:not-disabled:active:scale-100",
			},
			size: {
				default: "h-9 px-4",
				xs: "h-6 gap-1 px-2.5 text-xs [&_svg:not([class*='size-'])]:size-3",
				sm: "h-8 gap-1.5 px-3",
				lg: "h-11 px-5 text-base",
				icon: "size-9",
				"icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
				"icon-sm": "size-8",
				"icon-lg": "size-10",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

function Button({
	className,
	variant = "default",
	size = "default",
	asChild = false,
	...props
}: React.ComponentProps<"button"> &
	VariantProps<typeof buttonVariants> & {
		asChild?: boolean;
	}) {
	const Comp = asChild ? Slot.Root : "button";

	return (
		<Comp
			data-slot="button"
			data-variant={variant}
			data-size={size}
			className={cn(buttonVariants({ variant, size, className }))}
			{...props}
		/>
	);
}

/** The Get Started arrow: a chip whose arrow slides in on hover. Use on buttons that move the user forward. */
function ArrowChip() {
	return (
		<span
			aria-hidden="true"
			className="size-6 overflow-hidden rounded-full border border-white/10 bg-white/5 transition-colors duration-300 group-hover/button:bg-white/10"
		>
			<span className="flex w-12 -translate-x-1/2 transition-transform duration-300 ease-[cubic-bezier(0.77,0,0.175,1)] group-hover/button:translate-x-0 motion-reduce:transition-none">
				<span className="flex size-6">
					<span className="m-auto icon-[solar--arrow-right-linear] size-3.5" />
				</span>
				<span className="flex size-6">
					<span className="m-auto icon-[solar--arrow-right-linear] size-3.5" />
				</span>
			</span>
		</span>
	);
}

export { ArrowChip, Button, buttonVariants };
