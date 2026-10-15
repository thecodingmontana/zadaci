import type { ReactNode } from "react";
import {
	SelectContent,
	SelectItem,
	Select as SelectRoot,
	SelectTrigger,
	SelectValue,
} from "#/components/ui/select";
import { Switch } from "#/components/ui/switch";
import { cn } from "#/lib/utils";

// Building blocks ported from the reference settings page (srow / tog / sel / H).

export function SettingsHeader({
	title,
	lead,
}: {
	title: string;
	lead: ReactNode;
}) {
	return (
		<>
			<h1>{title}</h1>
			<p className="lead">{lead}</p>
		</>
	);
}

export function SRow({
	t,
	d,
	children,
}: {
	t: ReactNode;
	d?: ReactNode;
	children?: ReactNode;
}) {
	return (
		<div className="srow">
			<div>
				<div className="t">{t}</div>
				{d && <div className="d">{d}</div>}
			</div>
			<div className="row">{children}</div>
		</div>
	);
}

export function Toggle({
	checked,
	onChange,
	label,
	disabled,
}: {
	checked: boolean;
	onChange: (checked: boolean) => void;
	label: string;
	disabled?: boolean;
}) {
	return (
		<Switch
			checked={checked}
			onCheckedChange={onChange}
			disabled={disabled}
			aria-label={label}
		/>
	);
}

export function Select({
	value,
	options,
	onChange,
	label,
	disabled,
	className,
}: {
	value: string;
	options: readonly (readonly [string, string])[];
	onChange: (value: string) => void;
	label: string;
	disabled?: boolean;
	className?: string;
}) {
	// Radix Select can't use "" as an item value; map it to a sentinel and back.
	const EMPTY = "__none__";
	return (
		<SelectRoot
			value={value || EMPTY}
			onValueChange={(v) => onChange(v === EMPTY ? "" : v)}
			disabled={disabled}
		>
			<SelectTrigger
				className={cn("min-w-[180px]", className)}
				aria-label={label}
			>
				<SelectValue />
			</SelectTrigger>
			<SelectContent position="popper" className="max-h-72">
				{options.map(([v, n]) => (
					<SelectItem key={v || EMPTY} value={v || EMPTY}>
						{n}
					</SelectItem>
				))}
			</SelectContent>
		</SelectRoot>
	);
}

export function SBlock({
	title,
	children,
	first,
	danger,
}: {
	title?: string;
	children: ReactNode;
	first?: boolean;
	danger?: boolean;
}) {
	return (
		<div className="sblock" style={first ? { marginTop: 0 } : undefined}>
			{title && (
				<h2 style={danger ? { color: "var(--q-red)" } : undefined}>{title}</h2>
			)}
			{children}
		</div>
	);
}

export function Swatches({
	colors,
	value,
	onPick,
	size,
	label,
	checkmark,
}: {
	colors: readonly (readonly [string, string])[] | readonly string[];
	value: string | null | undefined;
	onPick: (key: string) => void;
	size?: number;
	label: string;
	checkmark?: boolean;
}) {
	return (
		<div className="swatches" role="radiogroup" aria-label={label}>
			{colors.map((entry) => {
				const [key, color] = typeof entry === "string" ? [entry, entry] : entry;
				const on = value === key;
				return (
					<label
						key={key}
						className={cn("sw", on && "on")}
						style={
							{
								"--c": color,
								...(size ? { width: size, height: size } : {}),
							} as React.CSSProperties
						}
					>
						<input
							type="radio"
							className="sr"
							name={label}
							checked={on}
							onChange={() => onPick(key)}
							aria-label={typeof entry === "string" ? `Color ${color}` : key}
						/>
						{checkmark && on && (
							<span
								className="icon-[hugeicons--tick-02] size-[13px]"
								aria-hidden="true"
							/>
						)}
					</label>
				);
			})}
		</div>
	);
}
