import { Tooltip as TooltipPrimitive } from "radix-ui";
import type * as React from "react";
import { useEffect, useState } from "react";
import { cn } from "#/lib/utils";

function TooltipProvider({
	delayDuration = 0,
	...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
	return (
		<TooltipPrimitive.Provider
			data-slot="tooltip-provider"
			delayDuration={delayDuration}
			{...props}
		/>
	);
}

function Tooltip({
	...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
	return <TooltipPrimitive.Root data-slot="tooltip" {...props} />;
}

function TooltipTrigger({
	...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
	return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

function TooltipContent({
	className,
	sideOffset = 0,
	children,
	...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
	return (
		<TooltipPrimitive.Portal>
			<TooltipPrimitive.Content
				data-slot="tooltip-content"
				sideOffset={sideOffset}
				className={cn(
					"z-50 w-fit origin-(--radix-tooltip-content-transform-origin) animate-in rounded-md bg-(--q-surface) px-2 py-1 text-[11px] font-medium text-balance text-(--q-text) shadow-(--q-shadow-pop) fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
					className,
				)}
				{...props}
			>
				{children}
				{/* light arrow that continues the bubble's outline (border on its two outward edges) */}
				<TooltipPrimitive.Arrow asChild>
					<span className="z-50 block size-2.5 translate-y-[calc(-50%_-_1px)] rotate-45 rounded-[2px] border-r border-b border-(--q-border-strong) bg-(--q-surface)" />
				</TooltipPrimitive.Arrow>
			</TooltipPrimitive.Content>
		</TooltipPrimitive.Portal>
	);
}

type Tip = {
	text: string;
	rect: DOMRect;
	side: "top" | "right" | "bottom" | "left";
};

/**
 * Every element with `data-tip` (and optional `data-tip-pos`) shows this tooltip — the same
 * one the collapsed sidebar uses — drawn above the page so no scroll box or card clips it.
 * Mount once, inside a TooltipProvider.
 */
function DataTips() {
	const [tip, setTip] = useState<Tip | null>(null);
	useEffect(() => {
		let timer: ReturnType<typeof setTimeout> | undefined;
		const tipOf = (t: EventTarget | null) =>
			t instanceof Element ? t.closest<HTMLElement>("[data-tip]") : null;
		const show = (e: Event) => {
			const el = tipOf(e.target);
			if (!el?.dataset.tip) return;
			clearTimeout(timer);
			// a short pause, so passing over a row of buttons doesn't flash every tip
			timer = setTimeout(
				() =>
					setTip({
						text: el.dataset.tip ?? "",
						rect: el.getBoundingClientRect(),
						side: (el.dataset.tipPos as Tip["side"]) ?? "bottom",
					}),
				e.type === "focusin" ? 0 : 350,
			);
		};
		const hide = (e: Event) => {
			const el = tipOf(e.target);
			const to = (e as PointerEvent).relatedTarget;
			// moving between the element's own children isn't leaving it
			if (el && to instanceof Node && el.contains(to)) return;
			clearTimeout(timer);
			setTip(null);
		};
		const clear = () => {
			clearTimeout(timer);
			setTip(null);
		};
		document.addEventListener("pointerover", show);
		document.addEventListener("pointerout", hide);
		document.addEventListener("focusin", show);
		document.addEventListener("focusout", hide);
		document.addEventListener("pointerdown", clear);
		window.addEventListener("scroll", clear, true);
		return () => {
			clearTimeout(timer);
			document.removeEventListener("pointerover", show);
			document.removeEventListener("pointerout", hide);
			document.removeEventListener("focusin", show);
			document.removeEventListener("focusout", hide);
			document.removeEventListener("pointerdown", clear);
			window.removeEventListener("scroll", clear, true);
		};
	}, []);
	if (!tip) return null;
	return (
		<Tooltip open>
			<TooltipTrigger asChild>
				{/* an invisible stand-in over the element, for the tooltip to point at */}
				<span
					aria-hidden="true"
					style={{
						position: "fixed",
						left: tip.rect.left,
						top: tip.rect.top,
						width: tip.rect.width,
						height: tip.rect.height,
						pointerEvents: "none",
					}}
				/>
			</TooltipTrigger>
			<TooltipContent
				side={tip.side}
				sideOffset={6}
				className="max-[900px]:hidden"
			>
				{tip.text}
			</TooltipContent>
		</Tooltip>
	);
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider, DataTips };
