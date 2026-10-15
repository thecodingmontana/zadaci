import { DropdownMenu } from "radix-ui";
import type { ReactNode } from "react";
import { cn } from "#/lib/utils";

// Reference popover menu look (.pop/.mi/.mh/.msep) on Radix DropdownMenu for keyboard + focus handling.

export const Menu = DropdownMenu.Root;
export const MenuTrigger = DropdownMenu.Trigger;

export function MenuContent({
	children,
	align = "end",
	width,
}: {
	children: ReactNode;
	align?: "start" | "end";
	width?: number;
}) {
	return (
		<DropdownMenu.Portal>
			<DropdownMenu.Content
				className="pop enter"
				align={align}
				sideOffset={4}
				style={{ position: "relative", width }}
			>
				{children}
			</DropdownMenu.Content>
		</DropdownMenu.Portal>
	);
}

export function MenuItem({
	icon,
	children,
	onSelect,
	danger,
	checked,
	disabled,
	r,
}: {
	icon?: string;
	children: ReactNode;
	onSelect: () => void;
	danger?: boolean;
	checked?: boolean;
	disabled?: boolean;
	r?: React.ReactNode;
}) {
	return (
		<DropdownMenu.Item
			className={cn("mi", danger && "danger")}
			onSelect={onSelect}
			disabled={disabled}
		>
			{icon && (
				<span
					className={cn(icon, "i size-[15px] shrink-0")}
					aria-hidden="true"
				/>
			)}
			{children}
			{r && <span className="r">{r}</span>}
			{checked && (
				<span className="ck">
					<span
						className="icon-[hugeicons--tick-02] size-3.5"
						aria-hidden="true"
					/>
				</span>
			)}
		</DropdownMenu.Item>
	);
}

export const MenuLabel = ({ children }: { children: ReactNode }) => (
	<DropdownMenu.Label className="mh">{children}</DropdownMenu.Label>
);
export const MenuSeparator = () => <DropdownMenu.Separator className="msep" />;
