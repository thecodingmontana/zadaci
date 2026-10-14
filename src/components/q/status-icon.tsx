// Status glyphs drawn like the reference: dashed ring, ring, half, three-quarter, filled check.
const KIND: Record<
	string,
	"backlog" | "todo" | "progress" | "review" | "done"
> = {
	idea: "backlog",
	abandoned: "backlog",
	todo: "todo",
	in_progress: "progress",
	in_review: "review",
	completed: "done",
};

export function StatusIcon({
	status,
	size = 14,
}: {
	status: string;
	size?: number;
}) {
	const kind = KIND[status] ?? "todo";
	const c = `var(--q-st-${kind})`;
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 14 14"
			aria-hidden="true"
			className="shrink-0"
		>
			{kind === "done" ? (
				<>
					<circle cx="7" cy="7" r="6.2" fill={c} />
					<path
						d="M4.4 7.2 6.2 9 9.7 5.3"
						fill="none"
						stroke="var(--q-surface)"
						strokeWidth="1.6"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				</>
			) : (
				<>
					<circle
						cx="7"
						cy="7"
						r="5.4"
						fill="none"
						stroke={c}
						strokeWidth="1.5"
						strokeDasharray={kind === "backlog" ? "1.9 2.1" : undefined}
					/>
					{kind === "progress" && (
						<path d="M7 3.4A3.6 3.6 0 0 1 7 10.6Z" fill={c} />
					)}
					{kind === "review" && (
						<path d="M7 3.4A3.6 3.6 0 1 1 3.4 7L7 7Z" fill={c} />
					)}
				</>
			)}
		</svg>
	);
}
