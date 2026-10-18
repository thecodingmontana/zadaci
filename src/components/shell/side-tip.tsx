import type { ReactElement } from "react";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "#/components/ui/tooltip";
import { useShell } from "./shell-state";

/** shadcn tooltip to the right of a sidebar item, only while the sidebar is collapsed to icons. */
export function SideTip({
	label,
	children,
	always,
}: {
	label: string;
	children: ReactElement;
	always?: boolean;
}) {
	const { collapsed } = useShell();
	if (!collapsed && !always) return children;
	return (
		<Tooltip>
			<TooltipTrigger asChild>{children}</TooltipTrigger>
			<TooltipContent
				side={collapsed ? "right" : "bottom"}
				sideOffset={6}
				className="max-[900px]:hidden"
			>
				{label}
			</TooltipContent>
		</Tooltip>
	);
}
