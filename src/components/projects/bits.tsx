import type { ReactNode } from "react";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "#/components/q/menu";
import { PCOLORS } from "#/lib/onboarding";
import { type ProjectStatus, PSTAT, pstat } from "#/lib/projects";
import { cn } from "#/lib/utils";

// Small project pieces from the reference helpers (pIcon, pStatus, progBar).

export const projectColor = (color: string | null | undefined) =>
	PCOLORS[color ?? ""] ?? color ?? PCOLORS.indigo;

export function PIcon({
	icon,
	color,
	size,
	px = 15,
}: {
	icon: string | null;
	color: string | null;
	size?: "lg";
	px?: number;
}) {
	return (
		<span
			className={cn("picon", size)}
			style={{ "--c": projectColor(color) } as React.CSSProperties}
		>
			<span
				className={cn(icon ?? "icon-[solar--folder-linear]")}
				style={{ width: px, height: px }}
				aria-hidden="true"
			/>
		</span>
	);
}

export function PStatus({ status }: { status: string }) {
	const s = pstat(status);
	return (
		<span className="pstatus" style={{ "--c": s.c } as React.CSSProperties}>
			<i />
			{s.name}
		</span>
	);
}

export function ProgBar({ value, tone }: { value: number; tone?: string }) {
	return (
		<span
			className={cn("prog", tone)}
			role="progressbar"
			aria-valuenow={value}
			aria-valuemin={0}
			aria-valuemax={100}
		>
			<i style={{ "--p": value / 100 } as React.CSSProperties} />
		</span>
	);
}

/** Project status picker (reference "pstatus" popover). */
export function StatusMenu({
	status,
	onPick,
	children,
	disabled,
	className,
}: {
	status: string;
	onPick: (status: ProjectStatus) => void;
	children: ReactNode;
	disabled?: boolean;
	className?: string;
}) {
	if (disabled) return <span className={className}>{children}</span>;
	return (
		<Menu>
			<MenuTrigger className={className} aria-label="Project status">
				{children}
			</MenuTrigger>
			<MenuContent align="start" width={200}>
				{(Object.keys(PSTAT) as ProjectStatus[]).map((k) => (
					<MenuItem key={k} checked={status === k} onSelect={() => onPick(k)}>
						<span
							className="pdot"
							style={
								{
									"--c": PSTAT[k].c,
									borderRadius: "50%",
								} as React.CSSProperties
							}
						/>
						{PSTAT[k].name}
					</MenuItem>
				))}
			</MenuContent>
		</Menu>
	);
}
