import { useRouter } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import { cn } from "#/lib/utils";

// The admin area's building blocks: a panel with an icon header, stat tiles with a change
// against the previous period, and an empty state.

/** Shared surface for every admin widget. */
export function Panel({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<section
			className={cn(
				"flex flex-col overflow-hidden rounded-xl border bg-card shadow-black/[0.03] shadow-sm",
				className,
			)}
		>
			{children}
		</section>
	);
}

export function PanelHeader({
	title,
	subtitle,
	icon,
	action,
}: {
	title: string;
	subtitle?: string;
	/** an Iconify class, like icon-[hugeicons--analytics-01] */
	icon?: string;
	action?: ReactNode;
}) {
	return (
		<div className="flex items-start justify-between gap-3 border-b px-4 py-3">
			<div className="min-w-0">
				<div className="flex items-center gap-2">
					{icon && (
						<span
							className={cn(icon, "size-4 shrink-0 text-brand")}
							aria-hidden="true"
						/>
					)}
					<h2 className="truncate font-medium text-[14px]">{title}</h2>
				</div>
				{subtitle && (
					<p className="mt-0.5 truncate text-[12.5px] text-muted-foreground">
						{subtitle}
					</p>
				)}
			</div>
			{action && <div className="shrink-0">{action}</div>}
		</div>
	);
}

export function PanelBody({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<div className={cn("flex flex-1 flex-col p-4", className)}>{children}</div>
	);
}

/** The change against the previous period. null: there was nothing to compare with. When
 * `lowerIsBetter` (errors), a rise shows red. */
export function Delta({
	percent,
	suffix = "vs previous 30 days",
	lowerIsBetter,
}: {
	percent: number | null;
	suffix?: string;
	lowerIsBetter?: boolean;
}) {
	if (percent === null)
		return (
			<span className="text-[11px] text-muted-foreground">
				No earlier period
			</span>
		);
	const up = percent >= 0;
	const good = lowerIsBetter ? !up || percent === 0 : up;
	return (
		<span className="flex items-center gap-1 text-[11px]">
			<span
				className={cn(
					"inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium tabular-nums",
					good
						? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
						: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
				)}
			>
				<span
					className={cn(
						"size-3",
						up
							? "icon-[hugeicons--arrow-up-right-01]"
							: "icon-[hugeicons--arrow-down-right-01]",
					)}
					aria-hidden="true"
				/>
				{`${up ? "+" : ""}${percent.toFixed(1)}%`}
			</span>
			<span className="text-muted-foreground">{suffix}</span>
		</span>
	);
}

/** Percent change from `before` to `now`; null when there was nothing before. */
export const change = (now: number, before: number) =>
	before === 0 ? (now === 0 ? 0 : null) : ((now - before) / before) * 100;

export function StatTile({
	icon,
	label,
	value,
	note,
	delta,
	deltaSuffix,
	lowerIsBetter,
}: {
	icon: string;
	label: string;
	value: string | number;
	note?: string;
	delta?: number | null;
	deltaSuffix?: string;
	lowerIsBetter?: boolean;
}) {
	return (
		<Panel>
			<PanelBody className="gap-2">
				<span className="flex items-center gap-2">
					<span className="grid size-7 shrink-0 place-content-center rounded-md bg-brand/10 text-brand">
						<span className={cn(icon, "size-4")} aria-hidden="true" />
					</span>
					<span className="truncate text-[11.5px] text-muted-foreground uppercase tracking-wide">
						{label}
					</span>
				</span>
				<p className="font-mono font-semibold text-2xl tabular-nums tracking-tight">
					{typeof value === "number" ? value.toLocaleString() : value}
				</p>
				{delta !== undefined && (
					<Delta
						percent={delta}
						suffix={deltaSuffix}
						lowerIsBetter={lowerIsBetter}
					/>
				)}
				{note && (
					<p className="truncate text-[12.5px] text-muted-foreground">{note}</p>
				)}
			</PanelBody>
		</Panel>
	);
}

export function EmptyPanel({
	icon,
	message,
}: {
	icon: string;
	message: string;
}) {
	return (
		<div className="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-center">
			<span className="grid size-11 place-content-center rounded-full bg-brand/10 text-brand">
				<span className={cn(icon, "size-5")} aria-hidden="true" />
			</span>
			<p className="max-w-xs text-[13px] text-muted-foreground">{message}</p>
		</div>
	);
}

/** A page's title, what it covers, and Refresh (reloads its data). */
export function AdminHeader({
	title,
	subtitle,
}: {
	title: string;
	subtitle: string;
}) {
	const router = useRouter();
	const [busy, setBusy] = useState(false);
	return (
		<div className="flex flex-wrap items-end justify-between gap-3">
			<div>
				<h1 className="font-semibold text-[22px] tracking-tight">{title}</h1>
				<p className="text-[13.5px] text-muted-foreground">{subtitle}</p>
			</div>
			<button
				type="button"
				className="btn btn-secondary"
				disabled={busy}
				onClick={() => {
					setBusy(true);
					void router.invalidate().finally(() => setBusy(false));
				}}
			>
				<span
					className={`icon-[hugeicons--refresh] size-4 ${busy ? "animate-spin" : ""}`}
					aria-hidden="true"
				/>
				Refresh
			</button>
		</div>
	);
}
