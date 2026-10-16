import { cn } from "#/lib/utils";

const COLORS = [
	"#5A67D8",
	"#C54B78",
	"#3B82C4",
	"#23918A",
	"#C48A1E",
	"#8662C9",
];

/** Stable colour per person so the same initials always look the same. */
export function avatarColor(seed: string) {
	let h = 0;
	for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) | 0;
	return COLORS[Math.abs(h) % COLORS.length];
}

export function Av({
	name,
	image,
	color,
	className,
}: {
	name: string;
	image?: string | null;
	color?: string | null;
	className?: string;
}) {
	const initials = name
		.split(/\s+/)
		.filter(Boolean)
		.map((w) => w[0])
		.join("")
		.slice(0, 2)
		.toUpperCase();
	if (image) {
		return (
			<img
				src={image}
				alt=""
				referrerPolicy="no-referrer"
				className={cn("av object-cover", className)}
			/>
		);
	}
	return (
		<span
			className={cn("av", className)}
			style={{ "--c": color ?? avatarColor(name) } as React.CSSProperties}
		>
			{initials || "?"}
		</span>
	);
}

/** Up to `max` faces, then "+N" (reference avStack). */
export function AvStack({
	people,
	max = 4,
	size = "sm",
}: {
	people: { id: string; name: string; image?: string | null }[];
	max?: number;
	size?: "sm" | "md";
}) {
	return (
		<span className="avs">
			{people.slice(0, max).map((p) => (
				<Av key={p.id} name={p.name} image={p.image} className={size} />
			))}
			{people.length > max && (
				<span className={cn("av more", size)}>+{people.length - max}</span>
			)}
		</span>
	);
}
